from rest_framework.permissions import BasePermission, SAFE_METHODS


def _perfil(request):
    """Helper: retorna el perfil del usuario autenticado o None."""
    try:
        return request.user.perfil
    except Exception:
        return None


class EsDirector(BasePermission):
    message = 'Solo el Director puede realizar esta acción.'

    def has_permission(self, request, view):
        p = _perfil(request)
        return bool(p and p.es_director and p.activo)


class EsAuxiliar(BasePermission):
    message = 'Solo el Auxiliar puede realizar esta acción.'

    def has_permission(self, request, view):
        p = _perfil(request)
        return bool(p and p.es_auxiliar and p.activo)


class EsDirectorOAuxiliar(BasePermission):
    message = 'Solo Director o Auxiliar pueden realizar esta acción.'

    def has_permission(self, request, view):
        p = _perfil(request)
        return bool(p and (p.es_director or p.es_auxiliar) and p.activo)


class PuedeJustificar(BasePermission):
    message = 'No tiene permiso para justificar inasistencias.'

    def has_permission(self, request, view):
        p = _perfil(request)
        return bool(p and p.puede_justificar and p.activo)


class UsuarioActivo(BasePermission):
    message = 'Usuario desactivado. Contacte al director.'

    def has_permission(self, request, view):
        p = _perfil(request)
        return bool(p and p.activo)


class GestionAlumnos(BasePermission):
    """
    Datos de alumnos/apoderados/grados:
      - Lectura  : Director, Auxiliar o Psicólogo (activos).
      - Escritura: solo Director o Auxiliar.
    El rol ESCANER (dispositivo físico) NO accede por aquí.
    """
    message = 'No tiene permiso sobre los datos de alumnos.'

    def has_permission(self, request, view):
        p = _perfil(request)
        if not (p and p.activo):
            return False
        if request.method in SAFE_METHODS:
            return p.es_director or p.es_auxiliar or p.es_psicologo
        return p.es_director or p.es_auxiliar
