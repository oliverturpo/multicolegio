"""Vistas a nivel de proyecto, independientes de cualquier app."""
from django.db import connection
from django.http import JsonResponse
from django_tenants.utils import get_public_schema_name


def tenant_no_encontrado(request):
    """
    Respuesta cuando el host no corresponde a ningún colegio registrado.

    django-tenants la invoca vía DEFAULT_NOT_FOUND_TENANT_VIEW cuando no
    existe un tenant para el subdominio, en vez de lanzar un Http404 HTML.
    """
    return JsonResponse({'detail': 'Colegio no encontrado'}, status=404)


def verify_tenant(request):
    """
    GET /api/v1/auth/verify-tenant/

    El frontend la llama al cargar el login para saber si el subdominio
    actual tiene un colegio registrado:
      - 200  → el colegio existe (devuelve su nombre).
      - 404  → es el schema public, o (vía tenant_no_encontrado) el
               subdominio no está registrado.
    """
    if connection.schema_name == get_public_schema_name():
        return JsonResponse({'detail': 'Colegio no encontrado'}, status=404)
    return JsonResponse({'detail': 'ok', 'colegio': request.tenant.nombre})
