from django.contrib import admin
from .models import Apoderado, GradoSeccion, Alumno


@admin.register(Apoderado)
class ApoderadoAdmin(admin.ModelAdmin):
    list_display  = ('apellido_paterno', 'apellido_materno', 'nombres', 'dni', 'sexo', 'parentesco', 'telefono_whatsapp')
    search_fields = ('dni', 'nombres', 'apellido_paterno', 'apellido_materno')
    list_filter   = ('sexo', 'parentesco')


class AlumnoInline(admin.TabularInline):
    model  = Alumno
    fields = ('codigo_barras', 'nombres', 'apellido_paterno', 'apellido_materno', 'grado_seccion', 'estado')
    readonly_fields = ('codigo_barras',)
    extra  = 0


@admin.register(GradoSeccion)
class GradoSeccionAdmin(admin.ModelAdmin):
    list_display  = ('grado', 'nombre_seccion', 'nivel', 'año_academico', 'total_alumnos')
    list_filter   = ('nivel', 'año_academico', 'grado')
    ordering      = ('año_academico', 'grado', 'nombre_seccion')

    def total_alumnos(self, obj):
        return obj.alumnos.filter(estado='ACTIVO').count()
    total_alumnos.short_description = 'Alumnos activos'


@admin.register(Alumno)
class AlumnoAdmin(admin.ModelAdmin):
    list_display   = ('apellido_paterno', 'apellido_materno', 'nombres', 'dni', 'codigo_barras', 'sexo', 'grado_seccion', 'estado')
    search_fields  = ('dni', 'codigo_barras', 'nombres', 'apellido_paterno', 'apellido_materno')
    list_filter    = ('sexo', 'estado', 'grado_seccion__grado', 'grado_seccion__año_academico')
    readonly_fields = ('codigo_barras', 'creado_en')
    raw_id_fields  = ('apoderado',)
    fieldsets = (
        ('Datos personales', {
            'fields': ('dni', 'nombres', 'apellido_paterno', 'apellido_materno', 'sexo', 'fecha_nacimiento', 'foto')
        }),
        ('Académico', {
            'fields': ('grado_seccion', 'apoderado', 'estado')
        }),
        ('Sistema', {
            'fields': ('codigo_barras', 'creado_en'),
            'classes': ('collapse',)
        }),
    )
