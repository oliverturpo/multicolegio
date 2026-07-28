from django.db import models
from django.contrib.auth.hashers import make_password, check_password


class Apoderado(models.Model):
    class Sexo(models.TextChoices):
        MASCULINO = 'M', 'Masculino'
        FEMENINO  = 'F', 'Femenino'

    class Parentesco(models.TextChoices):
        PADRE     = 'PADRE',     'Padre'
        MADRE     = 'MADRE',     'Madre'
        TUTOR     = 'TUTOR',     'Tutor'
        APODERADO = 'APODERADO', 'Apoderado'

    dni                = models.CharField(max_length=8, unique=True)
    nombres            = models.CharField(max_length=100)
    apellido_paterno   = models.CharField(max_length=80)
    apellido_materno   = models.CharField(max_length=80)
    sexo               = models.CharField(max_length=1, choices=Sexo.choices)
    telefono_whatsapp  = models.CharField(max_length=15)
    parentesco         = models.CharField(max_length=10, choices=Parentesco.choices)
    creado_en          = models.DateTimeField(auto_now_add=True)

    # --- Acceso del apoderado a la app móvil ---
    # `password` vacío = nunca ingresó: la clave inicial es su propio DNI.
    # Al ingresar por primera vez se le obliga a definir una contraseña propia.
    password              = models.CharField(max_length=128, blank=True, default='')
    debe_cambiar_password = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Apoderado'
        verbose_name_plural = 'Apoderados'

    def __str__(self):
        return f'{self.apellido_paterno} {self.apellido_materno}, {self.nombres}'

    @property
    def nombre_completo(self):
        return f'{self.nombres} {self.apellido_paterno} {self.apellido_materno}'

    # --- Autenticación (usado por la app de apoderados) ---
    def set_password(self, raw):
        self.password = make_password(raw)
        self.debe_cambiar_password = False

    def check_password(self, raw):
        """Valida la contraseña. Si nunca definió una, la clave inicial es su DNI."""
        if not self.password:
            return raw == self.dni
        return check_password(raw, self.password)

    @property
    def is_authenticated(self):
        # Permite que DRF trate a un Apoderado como request.user autenticado.
        return True


class GradoSeccion(models.Model):
    class Nivel(models.TextChoices):
        PRIMARIA   = 'PRIMARIA',   'Primaria'
        SECUNDARIA = 'SECUNDARIA', 'Secundaria'

    nivel          = models.CharField(max_length=10, choices=Nivel.choices)
    grado          = models.PositiveSmallIntegerField()
    nombre_seccion = models.CharField(max_length=60)  # "A", "B", "Albert Einstein"
    año_academico  = models.PositiveSmallIntegerField()

    class Meta:
        verbose_name = 'Grado y Sección'
        verbose_name_plural = 'Grados y Secciones'
        unique_together = ('grado', 'nombre_seccion', 'año_academico')

    def __str__(self):
        return f'{self.grado}° "{self.nombre_seccion}" — {self.nivel} {self.año_academico}'


class Alumno(models.Model):
    class Sexo(models.TextChoices):
        MASCULINO = 'M', 'Masculino'
        FEMENINO  = 'F', 'Femenino'

    class Estado(models.TextChoices):
        ACTIVO   = 'ACTIVO',   'Activo'
        RETIRADO = 'RETIRADO', 'Retirado'

    codigo_barras    = models.CharField(max_length=20, unique=True, editable=False)
    dni              = models.CharField(max_length=8, unique=True)
    nombres          = models.CharField(max_length=100)
    apellido_paterno = models.CharField(max_length=80)
    apellido_materno = models.CharField(max_length=80)
    sexo             = models.CharField(max_length=1, choices=Sexo.choices)
    fecha_nacimiento = models.DateField()
    foto             = models.ImageField(upload_to='alumnos/fotos/', blank=True, null=True)
    estado           = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVO)
    grado_seccion    = models.ForeignKey(GradoSeccion, on_delete=models.PROTECT, related_name='alumnos')
    apoderado        = models.ForeignKey(Apoderado, on_delete=models.PROTECT, related_name='hijos')
    creado_en        = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Alumno'
        verbose_name_plural = 'Alumnos'
        ordering = ['apellido_paterno', 'apellido_materno', 'nombres']

    def __str__(self):
        return f'{self.apellido_paterno} {self.apellido_materno}, {self.nombres}'

    @property
    def nombre_completo(self):
        return f'{self.nombres} {self.apellido_paterno} {self.apellido_materno}'

    def save(self, *args, **kwargs):
        # El código de barras / QR ES el DNI del alumno (al crear y al
        # editar). Sin prefijo: si se corrige el DNI, el código lo sigue.
        self.codigo_barras = self.dni
        super().save(*args, **kwargs)
