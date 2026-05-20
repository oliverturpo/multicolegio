from django.db import models
from django.contrib.auth.models import User


class UsuarioSistema(models.Model):
    class Rol(models.TextChoices):
        DIRECTOR   = 'DIRECTOR',   'Director'
        AUXILIAR   = 'AUXILIAR',   'Auxiliar'
        PSICOLOGO  = 'PSICOLOGO',  'Psicólogo'
        ESCANER    = 'ESCANER',    'Escáner'

    user   = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rol    = models.CharField(max_length=10, choices=Rol.choices)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Usuario del Sistema'
        verbose_name_plural = 'Usuarios del Sistema'

    def __str__(self):
        return f'{self.user.get_full_name()} ({self.get_rol_display()})'

    @property
    def es_director(self):
        return self.rol == self.Rol.DIRECTOR

    @property
    def es_auxiliar(self):
        return self.rol == self.Rol.AUXILIAR

    @property
    def es_psicologo(self):
        return self.rol == self.Rol.PSICOLOGO

    @property
    def es_escaner(self):
        return self.rol == self.Rol.ESCANER

    @property
    def puede_justificar(self):
        # Director, Auxiliar y Psicólogo pueden justificar inasistencias
        return self.rol in [self.Rol.DIRECTOR, self.Rol.AUXILIAR, self.Rol.PSICOLOGO]
