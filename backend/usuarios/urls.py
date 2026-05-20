from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioSistemaViewSet, YachayQRTokenView
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register('', UsuarioSistemaViewSet, basename='usuario')

urlpatterns = [
    path('login/',   YachayQRTokenView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(),  name='token_refresh'),
    path('',         include(router.urls)),
]
