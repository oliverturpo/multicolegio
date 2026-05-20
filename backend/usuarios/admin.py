from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.db import connection
from django.db.utils import ProgrammingError, OperationalError
from .models import UsuarioSistema


class UsuarioSistemaInline(admin.StackedInline):
    model  = UsuarioSistema
    fields = ('rol', 'activo')
    extra  = 1


def _en_tenant() -> bool:
    """UsuarioSistema vive en los schemas de colegio, NO en public."""
    return getattr(connection, 'schema_name', 'public') != 'public'


class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_rol', 'is_active')

    def get_inlines(self, request, obj=None):
        # En public la tabla usuarios_usuariosistema no existe → sin inline.
        return (UsuarioSistemaInline,) if _en_tenant() else ()

    @admin.display(description='Rol')
    def get_rol(self, obj):
        if not _en_tenant():
            return '—'
        try:
            return obj.perfil.get_rol_display()
        except (UsuarioSistema.DoesNotExist, ProgrammingError, OperationalError):
            return '—'


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(UsuarioSistema)
class UsuarioSistemaAdmin(admin.ModelAdmin):
    list_display = ('user', 'rol', 'activo')
    list_filter  = ('rol', 'activo')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')
