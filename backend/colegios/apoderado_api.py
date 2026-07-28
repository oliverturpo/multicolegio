"""
API de acceso para APODERADOS (app móvil).

Autenticación propia, separada del personal del colegio:
  - El apoderado inicia sesión con su DNI + contraseña.
  - La primera vez la clave es su propio DNI y se le obliga a cambiarla.
  - Se emite un JWT con claim `tipo='apoderado'` que NUNCA da acceso al
    panel del personal (auth class distinta + permiso IsApoderado).

Endpoints (bajo /api/v1/apoderado/):
  POST  login/                      → {access, debe_cambiar_password, apoderado}
  POST  cambiar-password/           → define la contraseña propia
  GET   mis-hijos/                  → hijos del apoderado + estado de hoy
  GET   hijo/<id>/asistencias/      → resumen + historial del hijo
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import Apoderado, Alumno
from asistencia.models import Asistencia


# ─── JWT del apoderado ──────────────────────────────────────────────────
def crear_token_apoderado(apo: Apoderado) -> str:
    """Genera un access token de apoderado (válido 30 días)."""
    token = AccessToken()
    token.set_exp(lifetime=timedelta(days=30))
    token['tipo']         = 'apoderado'
    token['apoderado_id'] = apo.id
    token['dni']          = apo.dni
    token['nombre']       = apo.nombre_completo
    return str(token)


class ApoderadoJWTAuthentication(BaseAuthentication):
    """Valida el JWT de apoderado y carga el Apoderado del schema actual."""

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header or header[0].lower() != b'bearer':
            return None
        if len(header) != 2:
            raise AuthenticationFailed('Encabezado de autorización inválido.')
        try:
            token = AccessToken(header[1].decode())
        except TokenError:
            raise AuthenticationFailed('Sesión expirada. Vuelve a ingresar.')
        if token.get('tipo') != 'apoderado':
            return None  # no es token de apoderado → que lo maneje otra auth
        apo = Apoderado.objects.filter(id=token.get('apoderado_id')).first()
        if apo is None:
            raise AuthenticationFailed('Apoderado no encontrado.')
        return (apo, token)


class IsApoderado(BasePermission):
    message = 'Solo para apoderados.'

    def has_permission(self, request, view):
        return isinstance(request.user, Apoderado)


# ─── Serialización ligera (sin ModelSerializer, respuestas a medida) ────
def _label_grado(gs):
    return f'{gs.grado}° "{gs.nombre_seccion}"'


def _foto_url(request, alumno):
    if alumno.foto:
        return request.build_absolute_uri(alumno.foto.url)
    return None


def _hijo_dict(request, alumno, estado_hoy=None):
    return {
        'id':              alumno.id,
        'nombre_completo': alumno.nombre_completo,
        'dni':             alumno.dni,
        'grado_seccion':   _label_grado(alumno.grado_seccion),
        'foto_url':        _foto_url(request, alumno),
        'estado_hoy':      estado_hoy,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────
class ApoderadoLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        dni = str(request.data.get('dni', '')).strip()
        password = str(request.data.get('password', ''))
        if not dni or not password:
            return Response({'detail': 'Ingresa tu DNI y contraseña.'},
                            status=status.HTTP_400_BAD_REQUEST)

        apo = Apoderado.objects.filter(dni=dni).first()
        if apo is None or not apo.check_password(password):
            return Response({'detail': 'DNI o contraseña incorrectos.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'access': crear_token_apoderado(apo),
            'debe_cambiar_password': apo.debe_cambiar_password or not apo.password,
            'apoderado': {'id': apo.id, 'nombre_completo': apo.nombre_completo},
        })


class ApoderadoCambiarPasswordView(APIView):
    authentication_classes = [ApoderadoJWTAuthentication]
    permission_classes = [IsApoderado]

    def post(self, request):
        apo = request.user
        nueva = str(request.data.get('password_nueva', ''))
        if len(nueva) < 8:
            return Response({'detail': 'La contraseña debe tener al menos 8 caracteres.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if nueva == apo.dni:
            return Response({'detail': 'La contraseña no puede ser tu DNI.'},
                            status=status.HTTP_400_BAD_REQUEST)
        apo.set_password(nueva)  # también pone debe_cambiar_password = False
        apo.save(update_fields=['password', 'debe_cambiar_password'])
        return Response({'ok': True})


class MisHijosView(APIView):
    authentication_classes = [ApoderadoJWTAuthentication]
    permission_classes = [IsApoderado]

    def get(self, request):
        apo = request.user
        hoy = timezone.localdate()
        hijos = (Alumno.objects
                 .filter(apoderado=apo)
                 .select_related('grado_seccion')
                 .order_by('apellido_paterno', 'nombres'))
        estados = dict(
            Asistencia.objects.filter(alumno__in=hijos, fecha=hoy)
            .values_list('alumno_id', 'estado')
        )
        data = [_hijo_dict(request, a, estados.get(a.id)) for a in hijos]
        return Response({'apoderado': apo.nombre_completo, 'hijos': data})


class HijoAsistenciasView(APIView):
    authentication_classes = [ApoderadoJWTAuthentication]
    permission_classes = [IsApoderado]

    def get(self, request, alumno_id):
        apo = request.user
        # Verificación de propiedad: el hijo debe pertenecer a este apoderado.
        alumno = Alumno.objects.filter(id=alumno_id, apoderado=apo).select_related('grado_seccion').first()
        if alumno is None:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        registros = (Asistencia.objects
                     .filter(alumno=alumno)
                     .order_by('-fecha'))

        resumen = {'PRESENTE': 0, 'TARDANZA': 0, 'AUSENTE': 0, 'JUSTIFICADO': 0}
        lista = []
        for r in registros:
            resumen[r.estado] = resumen.get(r.estado, 0) + 1
            lista.append({
                'fecha':         r.fecha.isoformat(),
                'estado':        r.estado,
                'hora_registro': r.hora_registro.strftime('%H:%M') if r.hora_registro else None,
            })

        return Response({
            'hijo':    _hijo_dict(request, alumno),
            'resumen': resumen,
            'total':   len(lista),
            'asistencias': lista,
        })
