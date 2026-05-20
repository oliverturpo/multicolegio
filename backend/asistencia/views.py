from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from django.db import connection, transaction
from django.utils import timezone
from django.utils.timezone import now
from datetime import datetime

from colegios.models import Alumno
from usuarios.models import UsuarioSistema

from .models import (
    HorarioEscolar, SesionDiaria, Asistencia,
    Justificacion, ContadorJustificacion, Notificacion,
)
from .serializers import (
    HorarioEscolarSerializer, SesionDiariaSerializer, AsistenciaSerializer,
    EscanearSerializer, JustificacionSerializer,
    ContadorJustificacionSerializer, NotificacionSerializer,
)
from .permissions import EsDirector, EsDirectorOAuxiliar, PuedeJustificar, UsuarioActivo
from .throttling import EscaneoThrottle
from .services import EscaneoService, EscaneoError
from .reportes import generar_excel, generar_pdf


# ── Horario ───────────────────────────────────────────────────────

class HorarioEscolarViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, UsuarioActivo]
    serializer_class   = HorarioEscolarSerializer
    queryset           = HorarioEscolar.objects.all()


# ── Sesión diaria ─────────────────────────────────────────────────

class SesionDiariaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, UsuarioActivo]
    serializer_class   = SesionDiariaSerializer

    def get_queryset(self):
        qs = SesionDiaria.objects.select_related('horario').order_by('-fecha')
        if fecha := self.request.query_params.get('fecha'):
            qs = qs.filter(fecha=fecha)
        return qs

    @action(detail=False, methods=['get'], url_path='hoy')
    def hoy(self, request):
        """Devuelve la sesión de hoy si existe."""
        try:
            sesion = SesionDiaria.objects.select_related('horario').get(
                fecha=timezone.localdate()
            )
            return Response(SesionDiariaSerializer(sesion).data)
        except SesionDiaria.DoesNotExist:
            return Response({'sesion': None, 'fecha': timezone.localdate()})

    @action(detail=True, methods=['post'], url_path='cerrar',
            permission_classes=[IsAuthenticated, UsuarioActivo, EsDirectorOAuxiliar])
    def cerrar(self, request, pk=None):
        """
        Cierra la sesión del día:
        1. Marca AUSENTE a todos los alumnos sin registro.
        2. Actualiza contadores.
        3. Encola tarea Celery para enviar WhatsApp.
        """
        sesion = self.get_object()

        if sesion.estado == SesionDiaria.Estado.CERRADA:
            return Response(
                {'error': 'La sesión ya está cerrada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            alumnos_con_registro = sesion.asistencias.values_list('alumno_id', flat=True)
            alumnos_sin_registro = Alumno.objects.filter(estado='ACTIVO').exclude(
                id__in=alumnos_con_registro
            )

            Asistencia.objects.bulk_create([
                Asistencia(
                    sesion=sesion,
                    alumno=alumno,
                    fecha=sesion.fecha,
                    estado=Asistencia.Estado.AUSENTE,
                    metodo=Asistencia.MetodoRegistro.AUTOMATICO,
                    registrado_por=request.user.perfil,
                )
                for alumno in alumnos_sin_registro
            ], ignore_conflicts=True)

            sesion.estado           = SesionDiaria.Estado.CERRADA
            sesion.hora_cierre_real = timezone.localtime().time()
            sesion.cerrada_por      = request.user.perfil
            sesion.save(update_fields=['estado', 'hora_cierre_real', 'cerrada_por'])
            sesion.actualizar_contadores()

        # El worker de Celery no tiene contexto de tenant: hay que pasarle
        # el schema del colegio explícitamente.
        from .tasks import enviar_whatsapp_sesion
        enviar_whatsapp_sesion.delay(connection.schema_name, sesion.id)

        return Response(SesionDiariaSerializer(sesion).data)


# ── Asistencia ────────────────────────────────────────────────────

class AsistenciaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, UsuarioActivo]
    serializer_class   = AsistenciaSerializer

    def get_queryset(self):
        qs     = Asistencia.objects.select_related(
            'alumno', 'alumno__grado_seccion', 'modificado_por__user'
        )
        params = self.request.query_params
        if sesion_id := params.get('sesion'):
            qs = qs.filter(sesion_id=sesion_id)
        if estado := params.get('estado'):
            qs = qs.filter(estado=estado)
        if fecha := params.get('fecha'):
            qs = qs.filter(fecha=fecha)
        if grado_id := params.get('grado_id'):
            qs = qs.filter(alumno__grado_seccion_id=grado_id)
        if buscar := params.get('buscar'):
            from django.db.models import Q
            qs = qs.filter(
                Q(alumno__nombres__icontains=buscar) |
                Q(alumno__apellido_paterno__icontains=buscar) |
                Q(alumno__apellido_materno__icontains=buscar) |
                Q(alumno__dni__icontains=buscar)
            )
        return qs.order_by('alumno__apellido_paterno', 'alumno__nombres')

    @action(detail=False, methods=['post'], url_path='escanear',
            throttle_classes=[EscaneoThrottle])
    def escanear(self, request):
        """
        Registra la asistencia de un alumno por código de barras.
        Abre la sesión automáticamente si es el primer escaneo del día.
        """
        serializer = EscanearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        codigo = serializer.validated_data['codigo_barras']
        metodo = request.data.get('metodo', Asistencia.MetodoRegistro.ESCANER)

        try:
            usuario = request.user.perfil
        except UsuarioSistema.DoesNotExist:
            usuario = None

        try:
            resultado = EscaneoService(usuario).procesar(codigo, metodo)
        except EscaneoError as e:
            return Response({'error': e.detail}, status=e.status_code)

        return Response(
            self._serializar_resultado(request, resultado),
            status=status.HTTP_200_OK if resultado.ya_registrado else status.HTTP_201_CREATED,
        )

    def _serializar_resultado(self, request, resultado):
        alumno     = resultado.alumno
        asistencia = resultado.asistencia

        foto_url = None
        if alumno.foto:
            try:
                foto_url = request.build_absolute_uri(alumno.foto.url)
            except Exception:
                pass

        data = {
            'ya_registrado': resultado.ya_registrado,
            'estado':        asistencia.estado,
            'alumno':        alumno.nombre_completo,
            'grado_label':   str(alumno.grado_seccion) if alumno.grado_seccion else '',
            'foto_url':      foto_url,
            'hora':          asistencia.hora_registro.strftime('%H:%M') if asistencia.hora_registro else '--:--',
            'mensaje':       self._mensaje(resultado),
        }

        if not resultado.ya_registrado:
            s = resultado.sesion
            data['sesion'] = {
                'id':              s.id,
                'total_alumnos':   s.total_alumnos,
                'total_presentes': s.total_presentes,
                'total_tardanzas': s.total_tardanzas,
                'total_ausentes':  s.total_ausentes,
            }

        return data

    @staticmethod
    def _mensaje(resultado) -> str:
        if resultado.ya_registrado:
            return 'El alumno ya fue registrado hoy.'
        return ('Presente registrado.' if resultado.asistencia.estado == 'PRESENTE'
                else 'Tardanza registrada.')

    @action(detail=True, methods=['patch'], url_path='cambiar-estado',
            permission_classes=[IsAuthenticated, UsuarioActivo, PuedeJustificar])
    def cambiar_estado(self, request, pk=None):
        """
        Cambia el estado de una asistencia.
        - Auxiliar: solo Tardanza → Presente, el mismo día.
        - Psicólogo/Director: puede justificar (límite 3 por alumno).
        """
        asistencia   = self.get_object()
        nuevo_estado = request.data.get('estado')
        usuario      = request.user.perfil

        if not nuevo_estado:
            return Response(
                {'error': 'Campo "estado" requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if usuario.es_auxiliar:
            error = self._validar_cambio_auxiliar(asistencia, nuevo_estado)
            if error:
                return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        if nuevo_estado == Asistencia.Estado.JUSTIFICADO:
            force_reset = bool(request.data.get('force_reset', False))
            error = self._aplicar_justificacion(
                asistencia, usuario, request.data.get('motivo', ''), force_reset
            )
            if error:
                return Response(error, status=status.HTTP_400_BAD_REQUEST)

        asistencia.estado_original = asistencia.estado
        asistencia.estado          = nuevo_estado
        asistencia.modificado_por  = usuario
        asistencia.modificado_en   = now()
        asistencia.save(update_fields=['estado', 'estado_original', 'modificado_por', 'modificado_en'])
        asistencia.sesion.actualizar_contadores()

        return Response(AsistenciaSerializer(asistencia).data)

    @action(detail=True, methods=['get'], url_path='justificacion-info',
            permission_classes=[IsAuthenticated, UsuarioActivo])
    def justificacion_info(self, request, pk=None):
        """Contador de justificaciones del alumno (para el modal: X de 3)."""
        asistencia = self.get_object()
        contador, _ = ContadorJustificacion.objects.get_or_create(
            alumno=asistencia.alumno
        )
        return Response({
            'cantidad':         contador.cantidad,
            'restantes':        contador.restantes,
            'limite':           ContadorJustificacion.LIMITE,
            'limite_alcanzado': contador.limite_alcanzado,
        })

    @staticmethod
    def _validar_cambio_auxiliar(asistencia, nuevo_estado) -> str | None:
        if asistencia.fecha != timezone.localdate():
            return 'El auxiliar solo puede modificar registros del día actual.'
        if not (asistencia.estado == 'TARDANZA' and nuevo_estado == 'PRESENTE'):
            return 'El auxiliar solo puede cambiar Tardanza a Presente.'
        return None

    @staticmethod
    def _aplicar_justificacion(asistencia, usuario, motivo, force_reset=False) -> dict | None:
        with transaction.atomic():
            ContadorJustificacion.objects.get_or_create(alumno=asistencia.alumno)
            # Bloqueo de fila: evita que dos peticiones simultáneas
            # incrementen el contador a la vez.
            contador = ContadorJustificacion.objects.select_for_update().get(
                alumno=asistencia.alumno
            )
            if contador.limite_alcanzado:
                if not force_reset:
                    # El frontend mostrará el aviso y el botón de confirmar.
                    return {
                        'error': f'El alumno alcanzó el límite de {ContadorJustificacion.LIMITE} justificaciones.',
                        'limite_alcanzado': True,
                        'requires_confirmation': True,
                        'cantidad': contador.cantidad,
                        'limite': ContadorJustificacion.LIMITE,
                    }
                # El Director confirmó: reinicia el ciclo de justificaciones.
                contador.cantidad = 0
                contador.save(update_fields=['cantidad'])

            _, creada = Justificacion.objects.get_or_create(
                asistencia=asistencia,
                defaults={'motivo': motivo, 'justificado_por': usuario},
            )
            # Solo cuenta si la justificación es NUEVA: re-justificar la
            # misma asistencia (doble clic, JUST→PRES→JUST) no debe sumar.
            if not creada:
                return None

            contador.cantidad += 1
            contador.save(update_fields=['cantidad'])

            if contador.limite_alcanzado:
                Notificacion.objects.create(
                    tipo=Notificacion.Tipo.LIMITE_JUSTIF,
                    mensaje=(
                        f'{asistencia.alumno.nombre_completo} ha alcanzado el límite '
                        f'de {ContadorJustificacion.LIMITE} justificaciones.'
                    ),
                    rol_destino=UsuarioSistema.Rol.DIRECTOR,
                )
        return None


# ── Notificaciones ────────────────────────────────────────────────

class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, UsuarioActivo]
    serializer_class   = NotificacionSerializer

    def get_queryset(self):
        try:
            rol = self.request.user.perfil.rol
        except Exception:
            return Notificacion.objects.none()
        return Notificacion.objects.filter(rol_destino=rol).order_by('-creada_en')

    @action(detail=False, methods=['get'], url_path='no-leidas')
    def no_leidas(self, request):
        return Response({'count': self.get_queryset().filter(leida=False).count()})

    @action(detail=True, methods=['post'], url_path='marcar-leida')
    def marcar_leida(self, request, pk=None):
        notif          = self.get_object()
        notif.leida    = True
        notif.leida_en = now()
        try:
            notif.leida_por = request.user.perfil
        except Exception:
            pass
        notif.save(update_fields=['leida', 'leida_en', 'leida_por'])
        return Response({'leida': True})

    @action(detail=False, methods=['post'], url_path='marcar-todas-leidas')
    def marcar_todas_leidas(self, request):
        self.get_queryset().filter(leida=False).update(leida=True, leida_en=now())
        return Response({'mensaje': 'Todas marcadas como leídas.'})


# ── Reportes (export Excel / PDF) ─────────────────────────────────

class _ReporteBase(APIView):
    """Comparte el parseo de filtros. Solo Director."""
    permission_classes = [IsAuthenticated, UsuarioActivo, EsDirector]

    def _filtros(self, request):
        fecha_str = request.query_params.get('fecha')
        try:
            fecha = (
                datetime.strptime(fecha_str, '%Y-%m-%d').date()
                if fecha_str else timezone.localdate()
            )
        except ValueError:
            fecha = timezone.localdate()
        return (
            fecha,
            request.query_params.get('grado_id') or None,
            request.query_params.get('estado') or None,
        )


class ReporteExcelView(_ReporteBase):
    def get(self, request):
        fecha, grado_id, estado = self._filtros(request)
        contenido = generar_excel(fecha, grado_id, estado)
        nombre = f"asistencia_{fecha.strftime('%Y%m%d')}.csv"
        return HttpResponse(
            contenido,
            content_type='text/csv; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename="{nombre}"'},
        )


class ReportePdfView(_ReporteBase):
    def get(self, request):
        fecha, grado_id, estado = self._filtros(request)
        contenido = generar_pdf(fecha, grado_id, estado)
        nombre = f"asistencia_{fecha.strftime('%Y%m%d')}.pdf"
        return HttpResponse(
            contenido,
            content_type='application/pdf',
            headers={'Content-Disposition': f'inline; filename="{nombre}"'},
        )
