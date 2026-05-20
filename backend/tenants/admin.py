from django.contrib import admin
from .models import Cliente, Dominio


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'schema_name', 'email_contacto', 'activo', 'creado_en')
    list_filter = ('activo',)
    search_fields = ('nombre', 'email_contacto')


@admin.register(Dominio)
class DominioAdmin(admin.ModelAdmin):
    list_display = ('domain', 'tenant', 'is_primary')

