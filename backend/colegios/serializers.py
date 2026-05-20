from rest_framework import serializers
from .models import Apoderado, GradoSeccion, Alumno


class ApoderadoSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()

    class Meta:
        model  = Apoderado
        fields = [
            'id', 'dni', 'nombres', 'apellido_paterno', 'apellido_materno',
            'nombre_completo', 'sexo', 'telefono_whatsapp', 'parentesco', 'creado_en',
        ]
        read_only_fields = ['id', 'creado_en']


class GradoSeccionSerializer(serializers.ModelSerializer):
    total_alumnos = serializers.SerializerMethodField()
    label         = serializers.ReadOnlyField(source='__str__')

    class Meta:
        model  = GradoSeccion
        fields = ['id', 'nivel', 'grado', 'nombre_seccion', 'año_academico', 'total_alumnos', 'label']
        read_only_fields = ['id']

    def get_total_alumnos(self, obj):
        return obj.alumnos.filter(estado='ACTIVO').count()


class AlumnoSerializer(serializers.ModelSerializer):
    nombre_completo  = serializers.ReadOnlyField()
    grado_seccion    = GradoSeccionSerializer(read_only=True)
    grado_seccion_id = serializers.PrimaryKeyRelatedField(
        queryset=GradoSeccion.objects.all(), source='grado_seccion', write_only=True
    )
    apoderado        = ApoderadoSerializer(read_only=True)
    apoderado_id     = serializers.PrimaryKeyRelatedField(
        queryset=Apoderado.objects.all(), source='apoderado', write_only=True
    )
    foto_url         = serializers.SerializerMethodField()

    class Meta:
        model  = Alumno
        fields = [
            'id', 'codigo_barras', 'dni', 'nombres', 'apellido_paterno', 'apellido_materno',
            'nombre_completo', 'sexo', 'fecha_nacimiento', 'foto', 'foto_url',
            'estado', 'grado_seccion', 'grado_seccion_id', 'apoderado', 'apoderado_id', 'creado_en',
        ]
        read_only_fields = ['id', 'codigo_barras', 'creado_en']

    def get_foto_url(self, obj):
        request = self.context.get('request')
        if obj.foto and request:
            return request.build_absolute_uri(obj.foto.url)
        return None


class AlumnoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados y escaneo — sin datos anidados pesados."""
    nombre_completo = serializers.ReadOnlyField()
    grado_label     = serializers.ReadOnlyField(source='grado_seccion.__str__')
    foto_url        = serializers.SerializerMethodField()
    apoderado       = serializers.SerializerMethodField()

    class Meta:
        model  = Alumno
        fields = [
            'id', 'codigo_barras', 'dni', 'nombre_completo',
            'sexo', 'grado_label', 'foto_url', 'estado', 'apoderado',
        ]

    def get_apoderado(self, obj):
        a = obj.apoderado
        if not a:
            return None
        return {
            'nombre_completo':   a.nombre_completo,
            'telefono_whatsapp': a.telefono_whatsapp,
            'parentesco':        a.parentesco,
        }

    def get_foto_url(self, obj):
        request = self.context.get('request')
        if obj.foto and request:
            return request.build_absolute_uri(obj.foto.url)
        return None
