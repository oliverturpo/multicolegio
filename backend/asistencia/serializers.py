from rest_framework import serializers
from django.utils import timezone
from colegios.serializers import AlumnoListSerializer
from usuarios.serializers import UsuarioSistemaSerializer
from .models import (
    HorarioEscolar, SesionDiaria, Asistencia,
    Justificacion, ContadorJustificacion, IngresoManual, Notificacion
)


class HorarioEscolarSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HorarioEscolar
        fields = '__all__'
        read_only_fields = ['id']


class SesionDiariaSerializer(serializers.ModelSerializer):
    porcentaje_asistencia = serializers.ReadOnlyField()
    horario               = HorarioEscolarSerializer(read_only=True)
    horario_id            = serializers.PrimaryKeyRelatedField(
        queryset=HorarioEscolar.objects.all(), source='horario', write_only=True
    )

    class Meta:
        model  = SesionDiaria
        fields = [
            'id', 'horario', 'horario_id', 'fecha', 'estado',
            'hora_apertura_real', 'hora_cierre_real',
            'total_alumnos', 'total_presentes', 'total_tardanzas',
            'total_ausentes', 'total_justificados',
            'porcentaje_asistencia', 'whatsapp_enviados',
            'abierta_por', 'cerrada_por',
        ]
        read_only_fields = [
            'id', 'hora_apertura_real', 'hora_cierre_real',
            'total_alumnos', 'total_presentes', 'total_tardanzas',
            'total_ausentes', 'total_justificados', 'whatsapp_enviados',
            'abierta_por', 'cerrada_por',
        ]


class AsistenciaSerializer(serializers.ModelSerializer):
    alumno         = AlumnoListSerializer(read_only=True)
    estado_display = serializers.ReadOnlyField(source='get_estado_display')
    metodo_display = serializers.ReadOnlyField(source='get_metodo_display')

    class Meta:
        model  = Asistencia
        fields = [
            'id', 'alumno', 'fecha', 'hora_registro', 'estado', 'estado_display',
            'metodo', 'metodo_display', 'estado_original',
            'modificado_por', 'modificado_en', 'observacion', 'whatsapp_enviado',
        ]
        read_only_fields = [
            'id', 'fecha', 'hora_registro', 'metodo',
            'estado_original', 'modificado_por', 'modificado_en', 'whatsapp_enviado',
        ]


class EscanearSerializer(serializers.Serializer):
    """Payload que llega cuando el escáner lee un código de barras."""
    codigo_barras = serializers.CharField(max_length=20)


class JustificacionSerializer(serializers.ModelSerializer):
    justificado_por_nombre = serializers.ReadOnlyField(source='justificado_por.user.get_full_name')

    class Meta:
        model  = Justificacion
        fields = ['id', 'asistencia', 'motivo', 'justificado_por', 'justificado_por_nombre', 'creado_en']
        read_only_fields = ['id', 'justificado_por', 'creado_en']


class ContadorJustificacionSerializer(serializers.ModelSerializer):
    limite_alcanzado = serializers.ReadOnlyField()
    restantes        = serializers.ReadOnlyField()

    class Meta:
        model  = ContadorJustificacion
        fields = ['id', 'alumno', 'cantidad', 'limite_alcanzado', 'restantes', 'actualizado_en']
        read_only_fields = fields


class NotificacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.ReadOnlyField(source='get_tipo_display')

    class Meta:
        model  = Notificacion
        fields = ['id', 'tipo', 'tipo_display', 'mensaje', 'rol_destino', 'leida', 'creada_en']
        read_only_fields = ['id', 'creada_en']
