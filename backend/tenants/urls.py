from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import PlataformaTokenView, ColegioViewSet

router = DefaultRouter()
router.register('colegios', ColegioViewSet, basename='colegio')

urlpatterns = [
    # POST /api/v1/plataforma/login/        → login del dueño (superusuario)
    # /api/v1/plataforma/colegios/          → CRUD de colegios (solo dueño)
    path('login/', PlataformaTokenView.as_view(), name='plataforma-login'),
    path('', include(router.urls)),
]
