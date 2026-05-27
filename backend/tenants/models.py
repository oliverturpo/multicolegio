from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


class Cliente(TenantMixin):
    """Representa un colegio dentro del SaaS."""
    nombre = models.CharField(max_length=200)
    email_contacto = models.EmailField()
    telefono = models.CharField(max_length=20, blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    activo = models.BooleanField(default=True)
    whatsapp_activo = models.BooleanField(
        default=False,
        help_text='Plan Premium: habilita el envío de notificaciones por WhatsApp.',
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    auto_create_schema = True

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def __str__(self):
        return self.nombre


class Dominio(DomainMixin):
    """Subdominio asociado a cada colegio: sanmarcos.yachayqr.pe"""
    class Meta:
        verbose_name = 'Dominio'
        verbose_name_plural = 'Dominios'
