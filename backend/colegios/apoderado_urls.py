from django.urls import path
from .apoderado_api import (
    ApoderadoLoginView, ApoderadoCambiarPasswordView,
    MisHijosView, HijoAsistenciasView,
)

urlpatterns = [
    path('login/',                          ApoderadoLoginView.as_view(),           name='apoderado-login'),
    path('cambiar-password/',               ApoderadoCambiarPasswordView.as_view(), name='apoderado-cambiar-password'),
    path('mis-hijos/',                      MisHijosView.as_view(),                 name='apoderado-mis-hijos'),
    path('hijo/<int:alumno_id>/asistencias/', HijoAsistenciasView.as_view(),        name='apoderado-hijo-asistencias'),
]
