"""
Capa de servicio para la lógica de escaneo de asistencia.

Responsabilidades:
- Abrir sesión automáticamente en el primer escaneo del día
- Verificar horario permitido
- Buscar alumno por código de barras
- Detectar doble registro
- Registrar ingreso manual (anti-fraude)
- Determinar estado PRESENTE / TARDANZA
- Crear el registro de asistencia
"""
from dataclasses import dataclass
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from colegios.models import Alumno
from usuarios.models import UsuarioSistema
from .models import (
    HorarioEscolar, SesionDiaria, Asistencia,
    IngresoManual, Notificacion,
)


# ── Excepciones de dominio ────────────────────────────────────────

class EscaneoError(Exception):
    """Base para errores controlados del escaneo."""
    status_code = 400

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class SesionCerradaError(EscaneoError):
    def __init__(self):
        super().__init__('La sesión del día ya fue cerrada.')


class SinHorarioError(EscaneoError):
    def __init__(self):
        super().__init__('No hay horario escolar configurado.')


class FueraDeHorarioError(EscaneoError):
    def __init__(self, detalle: str):
        super().__init__(f'Fuera de horario. {detalle}')


class AlumnoNoEncontradoError(EscaneoError):
    status_code = 404

    def __init__(self):
        super().__init__('Alumno no encontrado o inactivo.')


# ── Resultado del escaneo ─────────────────────────────────────────

@dataclass
class ResultadoEscaneo:
    alumno:        Alumno
    asistencia:    Asistencia
    sesion:        SesionDiaria
    ya_registrado: bool


# ── Servicio principal ────────────────────────────────────────────

class EscaneoService:
    """
    Orquesta el flujo completo de registro de asistencia.
    Uso:
        service = EscaneoService(usuario)
        resultado = service.procesar(codigo, metodo)
    """

    UMBRAL_ALERTA_MANUAL = 3  # alertar al director después de N ingresos manuales

    def __init__(self, usuario: UsuarioSistema | None):
        self.usuario = usuario

    def procesar(self, codigo: str, metodo: str) -> ResultadoEscaneo:
        with transaction.atomic():
            sesion = self._obtener_o_abrir_sesion()
            alumno = self._buscar_alumno(codigo)

            asistencia_existente = self._asistencia_del_dia(alumno)
            if asistencia_existente:
                return ResultadoEscaneo(
                    alumno=alumno,
                    asistencia=asistencia_existente,
                    sesion=sesion,
                    ya_registrado=True,
                )

            if metodo == Asistencia.MetodoRegistro.MANUAL:
                self._verificar_fraude(sesion, alumno)

            try:
                # Savepoint interior: el IntegrityError por doble escaneo
                # no aborta la transacción externa (requerido por PostgreSQL).
                with transaction.atomic():
                    asistencia = self._registrar(sesion, alumno, metodo)
            except IntegrityError:
                existente = self._asistencia_del_dia(alumno)
                if existente:
                    return ResultadoEscaneo(
                        alumno=alumno, asistencia=existente,
                        sesion=sesion, ya_registrado=True,
                    )
                raise

            sesion.actualizar_contadores()
            sesion.refresh_from_db()

            return ResultadoEscaneo(
                alumno=alumno,
                asistencia=asistencia,
                sesion=sesion,
                ya_registrado=False,
            )

    # ── Pasos privados ────────────────────────────────────────────

    def _obtener_o_abrir_sesion(self) -> SesionDiaria:
        hoy = timezone.localdate()

        sesion = SesionDiaria.objects.filter(
            fecha=hoy, estado=SesionDiaria.Estado.ABIERTA
        ).first()
        if sesion:
            return sesion

        if SesionDiaria.objects.filter(fecha=hoy).exists():
            raise SesionCerradaError()

        return self._abrir_sesion(hoy)

    def _abrir_sesion(self, hoy) -> SesionDiaria:
        horario = HorarioEscolar.objects.filter(activo=True).first()
        if not horario:
            raise SinHorarioError()

        hora_actual = timezone.localtime().time()

        dia_semana = hoy.weekday()  # 0=lunes … 6=domingo
        if dia_semana not in horario.dias_laborables:
            raise FueraDeHorarioError('Hoy no es día laborable.')

        if hora_actual < horario.hora_entrada:
            raise FueraDeHorarioError(
                f'La entrada empieza a las {horario.hora_entrada.strftime("%H:%M")}.'
            )
        if hora_actual > horario.hora_cierre:
            raise FueraDeHorarioError(
                f'El cierre fue a las {horario.hora_cierre.strftime("%H:%M")}.'
            )

        try:
            # Savepoint: si otro worker ya creó la sesión (fecha unique),
            # el IntegrityError no aborta la transacción exterior.
            with transaction.atomic():
                return SesionDiaria.objects.create(
                    horario=horario,
                    fecha=hoy,
                    estado=SesionDiaria.Estado.ABIERTA,
                    hora_apertura_real=hora_actual,
                    total_alumnos=Alumno.objects.filter(estado='ACTIVO').count(),
                    abierta_por=self.usuario,
                )
        except IntegrityError:
            sesion = SesionDiaria.objects.get(fecha=hoy)
            if sesion.estado == SesionDiaria.Estado.CERRADA:
                raise SesionCerradaError()
            return sesion

    def _buscar_alumno(self, codigo: str) -> Alumno:
        try:
            return Alumno.objects.select_related('grado_seccion').get(
                codigo_barras=codigo, estado='ACTIVO'
            )
        except Alumno.DoesNotExist:
            raise AlumnoNoEncontradoError()

    def _asistencia_del_dia(self, alumno: Alumno) -> Asistencia | None:
        return Asistencia.objects.filter(
            alumno=alumno, fecha=timezone.localdate()
        ).first()

    def _registrar(self, sesion: SesionDiaria, alumno: Alumno, metodo: str) -> Asistencia:
        hora_actual = timezone.localtime().time()
        estado = (
            Asistencia.Estado.PRESENTE
            if hora_actual <= sesion.horario.hora_limite_puntual
            else Asistencia.Estado.TARDANZA
        )
        return Asistencia.objects.create(
            sesion=sesion,
            alumno=alumno,
            fecha=timezone.localdate(),
            hora_registro=hora_actual,
            estado=estado,
            metodo=metodo,
            registrado_por=self.usuario,
        )

    def _verificar_fraude(self, sesion: SesionDiaria, alumno: Alumno) -> None:
        """Registra el intento manual y alerta al Director si supera el umbral."""
        tracker, _ = IngresoManual.objects.get_or_create(sesion=sesion, alumno=alumno)
        IngresoManual.objects.filter(pk=tracker.pk).update(
            cantidad=F('cantidad') + 1,
            ultimo_intento=timezone.now(),
        )
        tracker.refresh_from_db()

        if tracker.cantidad >= self.UMBRAL_ALERTA_MANUAL and not tracker.alerta_enviada:
            Notificacion.objects.create(
                tipo=Notificacion.Tipo.INGRESO_MANUAL,
                mensaje=(
                    f'Alerta: {alumno.nombre_completo} fue ingresado manualmente '
                    f'{tracker.cantidad} veces en la sesión del {sesion.fecha}.'
                ),
                rol_destino=UsuarioSistema.Rol.DIRECTOR,
            )
            tracker.alerta_enviada = True
            tracker.save(update_fields=['alerta_enviada'])
