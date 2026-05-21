from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from usuarios.views import YachayQRTokenView

# ── URLs del schema public (panel del dueño de la plataforma) ─────
# El registro abierto (AllowAny) se eliminó: ahora el alta de colegios
# es parte del panel protegido del dueño en /api/v1/plataforma/.
public_urlpatterns = [
    path('admin/',               admin.site.urls),
    path('api/v1/whatsapp/webhook/', __import__('asistencia.webhook_views', fromlist=['whatsapp_webhook']).whatsapp_webhook),
    path('api/v1/plataforma/',   include('tenants.urls')),     # login dueño + colegios
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(),   name='token_refresh'),
    path('api/v1/auth/verify/',  TokenVerifyView.as_view(),    name='token_verify'),
]

# ── URLs del schema de cada colegio ──────────────────────────────
urlpatterns = [
    path('admin/',               admin.site.urls),
    path('api/v1/auth/login/',   YachayQRTokenView.as_view(),  name='token_obtain'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(),   name='token_refresh'),
    path('api/v1/auth/verify/',  TokenVerifyView.as_view(),    name='token_verify'),
    path('api/v1/colegios/',     include('colegios.urls')),
    path('api/v1/asistencia/',   include('asistencia.urls')),
    path('api/v1/usuarios/',     include('usuarios.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
