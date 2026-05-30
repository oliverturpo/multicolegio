from django.db import models
from django.utils import timezone
from colegios.models import Alumno
from usuarios.models import UsuarioSistema


class HorarioEscolar(models.Model):
    nombre               = models.CharField(max_length=100)
    hora_entrada         = models.TimeField()
    hora_limite_puntual  = models.TimeField(help_text='Hasta esta hora se marca Presente')
    hora_cierre          = models.TimeField(help_text='A esta hora se cierran ausentes y se envían WhatsApp')
    dias_laborables      = models.JSONField(default=list)  # ["lun","mar","mie","jue","vie"]
    activo               = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Horario Escolar'
        verbose_name_plural = 'Horarios Escolares'

    def __str__(self):
        return f'{self.nombre} ({self.hora_entrada} – {self.hora_cierre})'


class SesionDiaria(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        ABIERTA   = 'ABIERTA',   'Abierta'
        CERRADA   = 'CERRADA',   'Cerrada'

    horario              = models.ForeignKey(HorarioEscolar, on_delete=models.PROTECT)
    fecha                = models.DateField(unique=True)
    estado               = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)

    # Tiempos reales de apertura/cierre
    hora_apertura_real   = models.TimeField(null=True, blank=True)
    hora_cierre_real     = models.TimeField(null=True, blank=True)

    # Contadores (se actualizan en cada escaneo)
    total_alumnos        = models.PositiveIntegerField(default=0)
    total_presentes      = models.PositiveIntegerField(default=0)
    total_tardanzas      = models.PositiveIntegerField(default=0)
    total_ausentes       = models.PositiveIntegerField(default=0)
    total_justificados   = models.PositiveIntegerField(default=0)

    abierta_por          = models.ForeignKey(
        UsuarioSistema, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sesiones_abiertas'
    )
    cerrada_por          = models.ForeignKey(
        UsuarioSistema, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sesiones_cerradas'
    )
    whatsapp_enviados    = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Sesión Diaria'
        verbose_name_plural = 'Sesiones Diarias'
        ordering = ['-fecha']

    def __str__(self):
        return f'Sesión {self.fecha} — {self.estado}'

    @property
    def porcentaje_asistencia(self):
        if self.total_alumnos == 0:
            return 0
        return round((self.total_presentes / self.total_alumnos) * 100, 1)

    def actualizar_contadores(self):
        from django.db.models import Count, Q
        stats = self.asistencias.aggregate(
            presentes   = Count('id', filter=Q(estado='PRESENTE')),
            tardanzas   = Count('id', filter=Q(estado='TARDANZA')),
            ausentes    = Count('id', filter=Q(estado='AUSENTE')),
            justificados= Count('id', filter=Q(estado='JUSTIFICADO')),
        )
        # UPDATE atómico: una sola sentencia SQL sin read-modify-write.
        # Dos workers concurrentes calculan el mismo aggregate y escriben
        # el mismo valor → idempotente, sin lost-update.
        SesionDiaria.objects.filter(pk=self.pk).update(
            total_presentes   = stats['presentes']    or 0,
            total_tardanzas   = stats['tardanzas']    or 0,
            total_ausentes    = stats['ausentes']     or 0,
            total_justificados= stats['justificados'] or 0,
        )
        self.refresh_from_db(fields=[
            'total_presentes', 'total_tardanzas',
            'total_ausentes', 'total_justificados',
        ])


class Asistencia(models.Model):
    class Estado(models.TextChoices):
        PRESENTE    = 'PRESENTE',    'Presente'
        TARDANZA    = 'TARDANZA',    'Tardanza'
        AUSENTE     = 'AUSENTE',     'Ausente'
        JUSTIFICADO = 'JUSTIFICADO', 'Justificado'

    class MetodoRegistro(models.TextChoices):
        ESCANER   = 'ESCANER',   'Escáner'
        MANUAL    = 'MANUAL',    'Manual'
        AUTOMATICO= 'AUTOMATICO','Automático'  # al cerrar sesión

    sesion         = models.ForeignKey(SesionDiaria, on_delete=models.PROTECT, related_name='asistencias')
    alumno         = models.ForeignKey(Alumno, on_delete=models.PROTECT, related_name='asistencias')
    fecha          = models.DateField()
    hora_registro  = models.TimeField(null=True, blank=True)
    estado         = models.CharField(max_length=12, choices=Estado.choices)
    metodo         = models.CharField(max_length=10, choices=MetodoRegistro.choices, default=MetodoRegistro.ESCANER)

    # Auditoría de cambios de estado
    estado_original = models.CharField(max_length=12, choices=Estado.choices, null=True, blank=True)
    modificado_por  = models.ForeignKey(
        UsuarioSistema, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='asistencias_modificadas'
    )
    modificado_en   = models.DateTimeField(null=True, blank=True)

    observacion      = models.TextField(blank=True)
    whatsapp_enviado = models.BooleanField(default=False)
    registrado_por   = models.ForeignKey(
        UsuarioSistema, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='asistencias_registradas'
    )

    class Meta:
        verbose_name = 'Asistencia'
        verbose_name_plural = 'Asistencias'
        unique_together = ('alumno', 'fecha')
        ordering = ['-fecha', 'alumno__apellido_paterno']
        indexes = [
            models.Index(fields=['fecha', 'estado']),
            models.Index(fields=['alumno', 'fecha']),
        ]

    def __str__(self):
        return f'{self.alumno} — {self.fecha} — {self.estado}'


class Justificacion(models.Model):
    asistencia      = models.OneToOneField(Asistencia, on_delete=models.CASCADE, related_name='justificacion')
    motivo          = models.TextField()
    justificado_por = models.ForeignKey(
        UsuarioSistema, on_delete=models.SET_NULL,
        null=True, related_name='justificaciones_emitidas'
    )
    creado_en       = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Justificación'
        verbose_name_plural = 'Justificaciones'

    def __str__(self):
        return f'Justificación de {self.asistencia.alumno} — {self.asistencia.fecha}'


class ContadorJustificacion(models.Model):
    """Lleva la cuenta de justificaciones por alumno. Límite: 3."""
    alumno     = models.OneToOneField(Alumno, on_delete=models.CASCADE, related_name='contador_justificaciones')
    cantidad   = models.PositiveSmallIntegerField(default=0)
    actualizado_en = models.DateTimeField(auto_now=True)

    LIMITE = 3

    class Meta:
        verbose_name = 'Contador de Justificaciones'
        verbose_name_plural = 'Contadores de Justificaciones'

    def __str__(self):
        return f'{self.alumno} — {self.cantidad}/{self.LIMITE}'

    @property
    def limite_alcanzado(self):
        return self.cantidad >= self.LIMITE

    @property
    def restantes(self):
        return max(0, self.LIMITE - self.cantidad)


class IngresoManual(models.Model):
    """Detecta intentos de ingresar DNI a mano en lugar de escanear. Anti-fraude."""
    sesion      = models.ForeignKey(SesionDiaria, on_delete=models.CASCADE, related_name='ingresos_manuales')
    alumno      = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='ingresos_manuales')
    cantidad    = models.PositiveSmallIntegerField(default=0)
    alerta_enviada = models.BooleanField(default=False)
    ultimo_intento = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ingreso Manual'
        verbose_name_plural = 'Ingresos Manuales'
        unique_together = ('sesion', 'alumno')

    def __str__(self):
        return f'Manual: {self.alumno} — sesión {self.sesion.fecha} ({self.cantidad} intentos)'


class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        INGRESO_MANUAL    = 'INGRESO_MANUAL',    'Ingreso manual detectado'
        LIMITE_JUSTIF     = 'LIMITE_JUSTIF',     'Límite de justificaciones'
        GENERAL           = 'GENERAL',           'General'

    tipo            = models.CharField(max_length=20, choices=Tipo.choices)
    mensaje         = models.TextField()
    # A qué rol va dirigida la notificación
    rol_destino     = models.CharField(max_length=10)
    leida           = models.BooleanField(default=False)
    creada_en       = models.DateTimeField(auto_now_add=True)
    leida_por       = models.ForeignKey(
        UsuarioSistema, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notificaciones_leidas'
    )
    leida_en        = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Notificación'
        verbose_name_plural = 'Notificaciones'
        ordering = ['-creada_en']

    def __str__(self):
        return f'[{self.tipo}] {self.mensaje[:50]}'
