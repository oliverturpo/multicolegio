from django.db import connection
from django_tenants.utils import get_public_schema_name
from rest_framework.permissions import BasePermission


class EsDuenoPlataforma(BasePermission):
    """
    Solo el administrador de la plataforma: superusuario autenticado
    Y operando en el schema `public` (dominio principal, no un colegio).
    """
    message = 'Solo el administrador de la plataforma puede realizar esta acción.'

    def has_permission(self, request, view):
        u = getattr(request, 'user', None)
        return bool(
            u and u.is_authenticated and u.is_superuser
            and connection.schema_name == get_public_schema_name()
        )
