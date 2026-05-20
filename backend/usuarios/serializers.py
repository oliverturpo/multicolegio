from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from config.turnstile import verificar_turnstile
from .models import UsuarioSistema


def _validar_password(value):
    """Aplica los AUTH_PASSWORD_VALIDATORS de Django."""
    try:
        validate_password(value)
    except DjangoValidationError as e:
        raise serializers.ValidationError(list(e.messages))
    return value


class UsuarioSistemaSerializer(serializers.ModelSerializer):
    username       = serializers.ReadOnlyField(source='user.username')
    email          = serializers.ReadOnlyField(source='user.email')
    nombre_completo= serializers.ReadOnlyField(source='user.get_full_name')
    rol_display    = serializers.ReadOnlyField(source='get_rol_display')

    class Meta:
        model  = UsuarioSistema
        fields = ['id', 'username', 'email', 'nombre_completo', 'rol', 'rol_display', 'activo']
        read_only_fields = ['id']


class CrearUsuarioSerializer(serializers.Serializer):
    username   = serializers.CharField(max_length=150)
    password   = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name  = serializers.CharField(max_length=150)
    email      = serializers.EmailField(required=False, allow_blank=True, default='')
    rol        = serializers.ChoiceField(choices=UsuarioSistema.Rol.choices)

    def validate_username(self, value):
        # En contexto de tenant esto consulta el auth_user del colegio,
        # así que la unicidad es por-colegio (no global).
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Ese nombre de usuario ya existe.')
        return value

    def validate_password(self, value):
        return _validar_password(value)

    def create(self, validated_data):
        rol    = validated_data.pop('rol')
        user   = User.objects.create_user(**validated_data)
        perfil = UsuarioSistema.objects.create(user=user, rol=rol)
        return perfil


class EditarUsuarioSerializer(serializers.Serializer):
    """Edición de usuario: todos los campos son opcionales excepto los que se envíen."""
    first_name = serializers.CharField(max_length=150, required=False)
    last_name  = serializers.CharField(max_length=150, required=False)
    email      = serializers.EmailField(required=False, allow_blank=True)
    rol        = serializers.ChoiceField(choices=UsuarioSistema.Rol.choices, required=False)
    activo     = serializers.BooleanField(required=False)
    password   = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=False)

    def validate_password(self, value):
        return _validar_password(value)

    def update(self, instance, validated_data):
        user = instance.user
        # Campos del User de Django
        for field in ('first_name', 'last_name', 'email'):
            if field in validated_data:
                setattr(user, field, validated_data[field])
        if 'password' in validated_data:
            user.set_password(validated_data['password'])
        user.save()
        # Campos del perfil
        if 'rol' in validated_data:
            instance.rol = validated_data['rol']
        if 'activo' in validated_data:
            instance.activo = validated_data['activo']
        instance.save()
        return instance


class YachayQRTokenSerializer(TokenObtainPairSerializer):
    """JWT personalizado: incluye datos del usuario en el token."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        try:
            perfil = user.perfil
            token['rol']            = perfil.rol
            token['nombre_completo']= user.get_full_name()
            token['activo']         = perfil.activo
        except UsuarioSistema.DoesNotExist:
            token['rol'] = None
        return token

    def validate(self, attrs):
        # Anti-bot: validar Turnstile ANTES de comprobar credenciales.
        request = self.context.get('request')
        token = (request.data.get('cf_turnstile_token') if request else '') or ''
        ip = request.META.get('REMOTE_ADDR') if request else None
        if not verificar_turnstile(token, ip):
            raise serializers.ValidationError(
                'Verificación de seguridad fallida. Recarga la página e intenta de nuevo.'
            )

        # Colegio suspendido por el dueño → login bloqueado.
        from django.db import connection
        tenant = getattr(connection, 'tenant', None)
        if tenant is not None and not getattr(tenant, 'activo', True):
            raise serializers.ValidationError(
                'Este colegio está suspendido. Contacte al administrador de la plataforma.'
            )

        data = super().validate(attrs)
        try:
            perfil = self.user.perfil
            if not perfil.activo:
                raise serializers.ValidationError('Usuario desactivado. Contacte al director.')
            data['rol']             = perfil.rol
            data['nombre_completo'] = self.user.get_full_name()
        except UsuarioSistema.DoesNotExist:
            pass
        return data
