from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApoderadoViewSet, GradoSeccionViewSet, AlumnoViewSet

router = DefaultRouter()
router.register('apoderados',    ApoderadoViewSet,    basename='apoderado')
router.register('grados',        GradoSeccionViewSet, basename='gradoseccion')
router.register('alumnos',       AlumnoViewSet,       basename='alumno')

urlpatterns = [path('', include(router.urls))]
