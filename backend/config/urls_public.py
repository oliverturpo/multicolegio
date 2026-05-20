"""
URLconf del schema `public` (dominio principal / panel del dueño).

django-tenants usa este módulo SOLO cuando el request llega al tenant
público, gracias a `PUBLIC_SCHEMA_URLCONF` en settings. Sin ese ajuste,
`public_urlpatterns` queda muerto y `/api/v1/plataforma/` da 404.
"""
from config.urls import public_urlpatterns as urlpatterns  # noqa: F401
