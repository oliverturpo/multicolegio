from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HorarioEscolarViewSet, SesionDiariaViewSet, AsistenciaViewSet,
    NotificacionViewSet, ReporteExcelView, ReportePdfView,
)

router = DefaultRouter()
router.register('horarios',      HorarioEscolarViewSet, basename='horario')
router.register('sesiones',      SesionDiariaViewSet,   basename='sesion')
router.register('registros',     AsistenciaViewSet,     basename='asistencia')
router.register('notificaciones',NotificacionViewSet,   basename='notificacion')

urlpatterns = [
    path('reportes/excel/', ReporteExcelView.as_view(), name='reporte-excel'),
    path('reportes/pdf/',   ReportePdfView.as_view(),   name='reporte-pdf'),
    path('', include(router.urls)),
]
