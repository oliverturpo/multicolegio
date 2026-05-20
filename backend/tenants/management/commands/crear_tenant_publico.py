from django.core.management.base import BaseCommand
from tenants.models import Cliente, Dominio


class Command(BaseCommand):
    help = 'Crea el tenant público de YachayQR (requerido por django-tenants)'

    def handle(self, *args, **kwargs):
        if Cliente.objects.filter(schema_name='public').exists():
            self.stdout.write(self.style.WARNING('El tenant público ya existe.'))
            return

        tenant = Cliente(
            schema_name='public',
            nombre='YachayQR — Plataforma',
            email_contacto='admin@yachayqr.pe',
        )
        tenant.save()

        Dominio.objects.create(
            domain='localhost',
            tenant=tenant,
            is_primary=True,
        )

        self.stdout.write(self.style.SUCCESS('Tenant publico creado: localhost -> schema public'))
