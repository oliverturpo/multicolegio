import re

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from config.turnstile import verificar_turnstile
from .models import Cliente

# Identificador de schema PostgreSQL seguro: minúscula inicial, sin guiones.
SUBDOMINIO_RE = re.compile(r'^[a-z][a-z0-9]{2,30}$')
SUBDOMINIOS_RESERVADOS = {
    'public', 'www', 'admin', 'api', 'app', 'static', 'media',
    'localhost', 'mail', 'ftp', 'test', 'tenant', 'yachayqr', 'plataforma',
}

# Límites del logo del colegio. Se sirve en el selector de la app móvil, así
# que conviene mantenerlo liviano (se descarga en cada carga de la lista).
LOGO_MAX_BYTES = 2 * 1024 * 1024      # 2 MB
LOGO_FORMATOS  = {'PNG', 'JPEG', 'WEBP'}


class PlataformaTokenSerializer(TokenObtainPairSerializer):
    """Login del dueño: solo superusuarios del schema public."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['plataforma']      = True
        token['nombre_completo'] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        request = self.context.get('request')
        token = (request.data.get('cf_turnstile_token') if request else '') or ''
        ip = request.META.get('REMOTE_ADDR') if request else None
        if not verificar_turnstile(token, ip):
            raise serializers.ValidationError(
                'Verificación de seguridad fallida. Recarga la página e intenta de nuevo.'
            )

        data = super().validate(attrs)
        if not self.user.is_superuser:
            raise serializers.ValidationError(
                'Esta cuenta no tiene acceso al panel de plataforma.'
            )
        data['plataforma']      = True
        data['nombre_completo'] = self.user.get_full_name() or self.user.username
        return data


def url_logo(cliente, request=None):
    """
    URL del logo de un colegio, o None si no tiene.

    Se devuelve absoluta: la consume tanto el panel del dueño como la app
    móvil, que no comparten origen con el backend y no pueden resolver una
    ruta relativa.
    """
    if not cliente.logo:
        return None
    url = cliente.logo.url
    return request.build_absolute_uri(url) if request else url


class ColegioSerializer(serializers.ModelSerializer):
    """Lectura: un colegio (tenant) en el listado del dueño."""
    dominio    = serializers.SerializerMethodField()
    url_acceso = serializers.SerializerMethodField()
    logo       = serializers.SerializerMethodField()

    class Meta:
        model  = Cliente
        fields = ['id', 'nombre', 'schema_name', 'email_contacto',
                  'telefono', 'activo', 'whatsapp_activo', 'creado_en',
                  'dominio', 'url_acceso', 'logo']
        read_only_fields = fields

    def get_dominio(self, obj):
        d = obj.domains.filter(is_primary=True).first() or obj.domains.first()
        return d.domain if d else None

    def get_url_acceso(self, obj):
        # URL del frontend del colegio (donde el Director hace login).
        return settings.TENANT_LOGIN_URL_TEMPLATE.format(sub=obj.schema_name)

    def get_logo(self, obj):
        return url_logo(obj, self.context.get('request'))


class LogoColegioSerializer(serializers.ModelSerializer):
    """Subida del logo de un colegio (multipart, solo el dueño)."""
    logo = serializers.ImageField()

    class Meta:
        model  = Cliente
        fields = ['logo']

    def validate_logo(self, archivo):
        if archivo.size > LOGO_MAX_BYTES:
            raise serializers.ValidationError(
                f'La imagen pesa {archivo.size // 1024} KB. El máximo es '
                f'{LOGO_MAX_BYTES // 1024} KB.'
            )
        # ImageField ya garantiza que es una imagen legible (Pillow); aquí
        # solo restringimos a formatos que el navegador y la app renderizan.
        formato = (getattr(archivo.image, 'format', '') or '').upper()
        if formato not in LOGO_FORMATOS:
            raise serializers.ValidationError(
                f'Formato {formato or "desconocido"} no admitido. '
                f'Usa {", ".join(sorted(LOGO_FORMATOS))}.'
            )
        return archivo


class CrearColegioSerializer(serializers.Serializer):
    """Alta de un colegio + su Director inicial (lo usa el dueño)."""
    nombre          = serializers.CharField(max_length=200)
    subdominio      = serializers.CharField(max_length=31)
    email_contacto  = serializers.EmailField()
    telefono        = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    admin_password  = serializers.CharField(write_only=True, min_length=8)
    whatsapp_activo = serializers.BooleanField(required=False, default=False)

    def validate_subdominio(self, value):
        value = value.strip().lower()
        if not SUBDOMINIO_RE.match(value):
            raise serializers.ValidationError(
                'Subdominio inválido: 3-31 caracteres, minúsculas y números, '
                'empezando por una letra (sin espacios ni guiones).'
            )
        if value in SUBDOMINIOS_RESERVADOS:
            raise serializers.ValidationError('Ese subdominio está reservado.')
        if Cliente.objects.filter(schema_name=value).exists():
            raise serializers.ValidationError('Ese subdominio ya está en uso.')
        return value

    def validate_admin_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value
