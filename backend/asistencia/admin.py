from django.contrib import admin
from django.utils.html import format_html
from .models import (
    HorarioEscolar, SesionDiaria, Asistencia,
    Justificacion, ContadorJustificacion, IngresoManual, Notificacion
)


@admin.register(HorarioEscolar)
class HorarioEscolarAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'hora_entrada', 'hora_limite_puntual', 'hora_cierre', 'activo')
    list_filter  = ('activo',)


class AsistenciaInline(admin.TabularInline):
    model   = Asistencia
    fields  = ('alumno', 'hora_registro', 'estado', 'metodo', 'whatsapp_enviado')
    readonly_fields = ('alumno', 'hora_registro', 'metodo')
    extra   = 0
    can_delete = False


@admin.register(SesionDiaria)
class SesionDiariaAdmin(admin.ModelAdmin):
    list_display  = ('fecha', 'estado', 'total_alumnos', 'total_presentes', 'total_tardanzas', 'total_ausentes', 'porcentaje_badge', 'whatsapp_enviados')
    list_filter   = ('estado', 'fecha')
    readonly_fields = ('hora_apertura_real', 'hora_cierre_real', 'total_alumnos', 'total_presentes', 'total_tardanzas', 'total_ausentes', 'total_justificados', 'whatsapp_enviados')
    inlines       = [AsistenciaInline]

    def porcentaje_badge(self, obj):
        p = obj.porcentaje_asistencia
        color = 'green' if p >= 80 else 'orange' if p >= 60 else 'red'
        return format_html('<b style="color:{}">{} %</b>', color, p)
    porcentaje_badge.short_description = '% Asistencia'


@admin.register(Asistencia)
class AsistenciaAdmin(admin.ModelAdmin):
    list_display  = ('alumno', 'fecha', 'estado', 'hora_registro', 'metodo', 'whatsapp_enviado', 'modificado_por')
    list_filter   = ('estado', 'metodo', 'fecha', 'whatsapp_enviado')
    search_fields = ('alumno__dni', 'alumno__nombres', 'alumno__apellido_paterno')
    readonly_fields = ('estado_original', 'modificado_por', 'modificado_en', 'registrado_por')
    date_hierarchy = 'fecha'


@admin.register(Justificacion)
class JustificacionAdmin(admin.ModelAdmin):
    list_display  = ('asistencia', 'justificado_por', 'creado_en')
    search_fields = ('asistencia__alumno__apellido_paterno', 'asistencia__alumno__dni')
    readonly_fields = ('creado_en',)


@admin.register(ContadorJustificacion)
class ContadorJustificacionAdmin(admin.ModelAdmin):
    list_display  = ('alumno', 'cantidad', 'restantes_badge', 'actualizado_en')
    search_fields = ('alumno__dni', 'alumno__apellido_paterno')
    readonly_fields = ('actualizado_en',)

    def restantes_badge(self, obj):
        color = 'red' if obj.limite_alcanzado else 'orange' if obj.restantes == 1 else 'green'
        return format_html('<b style="color:{}">{}</b>', color, obj.restantes)
    restantes_badge.short_description = 'Restantes'


@admin.register(IngresoManual)
class IngresoManualAdmin(admin.ModelAdmin):
    list_display = ('alumno', 'sesion', 'cantidad', 'alerta_enviada', 'ultimo_intento')
    list_filter  = ('alerta_enviada',)
    search_fields = ('alumno__dni', 'alumno__apellido_paterno')


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display  = ('tipo', 'mensaje_corto', 'rol_destino', 'leida', 'creada_en')
    list_filter   = ('tipo', 'leida', 'rol_destino')
    readonly_fields = ('creada_en', 'leida_en')

    def mensaje_corto(self, obj):
        return obj.mensaje[:60]
    mensaje_corto.short_description = 'Mensaje'
