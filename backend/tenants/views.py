from django.conf import settings
from django.contrib.auth.models import User
from django_tenants.utils import schema_context
from rest_framework import viewsets, status
from rest_framework.decorators import (
    action, api_view, authentication_classes, permission_classes,
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Cliente, Dominio
from .permissions import EsDuenoPlataforma
from .serializers import (
    PlataformaTokenSerializer, ColegioSerializer, CrearColegioSerializer,
    LogoColegioSerializer, url_logo,
)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def colegios_publicos(request):
    """
    Lista pública de colegios activos, para el selector de la app móvil.
    Corre en el schema public (dominio principal). Devuelve el dominio de
    cada colegio para que la app arme la URL de su API.
    """
    data = []
    for c in (Cliente.objects.filter(activo=True)
              .exclude(schema_name='public').order_by('nombre')):
        dom = c.domains.filter(is_primary=True).first() or c.domains.first()
        if dom:
            data.append({
                'nombre':  c.nombre,
                'schema':  c.schema_name,
                'dominio': dom.domain,
                'logo':    url_logo(c, request),
            })
    return Response(data)


class PlataformaTokenView(TokenObtainPairView):
    """Login del dueño (superusuario, schema public)."""
    serializer_class = PlataformaTokenSerializer


class ColegioViewSet(viewsets.ModelViewSet):
    """
    Administración de colegios (tenants). Solo el dueño de la plataforma.
    - list/retrieve: ver colegios
    - create:        alta de colegio + Director inicial (en su schema)
    - toggle-activo: suspender / reactivar un colegio
    DELETE deshabilitado: para suspender usar toggle-activo (no se puede
    deshacer un DROP SCHEMA accidental).
    """
    permission_classes = [IsAuthenticated, EsDuenoPlataforma]
    http_method_names  = ['get', 'post', 'put', 'patch', 'head', 'options']
    queryset = Cliente.objects.exclude(schema_name='public').order_by('-creado_en')

    def get_serializer_class(self):
        if self.action == 'create':
            return CrearColegioSerializer
        return ColegioSerializer

    def create(self, request, *args, **kwargs):
        ser = CrearColegioSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        # 1. Crear tenant + dominio. auto_create_schema corre las migraciones
        #    del nuevo schema; django-tenants gestiona su propia transacción
        #    de DDL, por eso NO se envuelve en transaction.atomic().
        cliente = Cliente(
            schema_name=d['subdominio'],
            nombre=d['nombre'],
            email_contacto=d['email_contacto'],
            telefono=d.get('telefono', ''),
            whatsapp_activo=d.get('whatsapp_activo', False),
        )
        cliente.save()
        Dominio.objects.create(
            domain=f"{d['subdominio']}.{settings.TENANT_DOMAIN_SUFFIX}",
            tenant=cliente,
            is_primary=True,
        )

        # 2. Crear el Director inicial DENTRO del schema del colegio
        from usuarios.models import UsuarioSistema
        with schema_context(d['subdominio']):
            user = User.objects.create_user(
                username='director',
                password=d['admin_password'],
                first_name='Director',
                email=d['email_contacto'],
            )
            UsuarioSistema.objects.create(
                user=user, rol=UsuarioSistema.Rol.DIRECTOR, activo=True
            )

        return Response(
            {
                'colegio': ColegioSerializer(cliente, context={'request': request}).data,
                'acceso': {
                    'url': settings.TENANT_LOGIN_URL_TEMPLATE.format(sub=d['subdominio']),
                    'usuario': 'director',
                },
                'mensaje': f"Colegio \"{d['nombre']}\" creado. El Director ya puede ingresar.",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='toggle-activo')
    def toggle_activo(self, request, pk=None):
        """Suspende o reactiva un colegio (bloquea/permite su login)."""
        cliente = self.get_object()
        cliente.activo = not cliente.activo
        cliente.save(update_fields=['activo'])
        return Response(self.get_serializer(cliente).data)

    @action(detail=True, methods=['post'], url_path='toggle-whatsapp')
    def toggle_whatsapp(self, request, pk=None):
        """Activa o desactiva el plan de notificaciones WhatsApp del colegio."""
        cliente = self.get_object()
        cliente.whatsapp_activo = not cliente.whatsapp_activo
        cliente.save(update_fields=['whatsapp_activo'])
        return Response(self.get_serializer(cliente).data)

    @action(detail=True, methods=['post'], url_path='logo',
            parser_classes=[MultiPartParser, FormParser])
    def logo(self, request, pk=None):
        """
        Sube el logo del colegio (multipart, campo `logo`). Se muestra en el
        selector de la app de apoderados y en este panel.
        """
        cliente = self.get_object()
        anterior = cliente.logo.name or None

        ser = LogoColegioSerializer(cliente, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()

        # Al reemplazar, Django guarda el archivo nuevo con otro nombre y deja
        # el viejo huérfano en disco: lo borramos a mano.
        if anterior and anterior != cliente.logo.name:
            cliente.logo.storage.delete(anterior)

        return Response(self.get_serializer(cliente).data)

    @action(detail=True, methods=['post'], url_path='quitar-logo')
    def quitar_logo(self, request, pk=None):
        """
        Quita el logo del colegio (vuelve al marcador con iniciales).
        Es POST y no DELETE porque `http_method_names` del ViewSet excluye
        DELETE para que nadie pueda borrar un colegio por accidente.
        """
        cliente = self.get_object()
        if cliente.logo:
            cliente.logo.delete(save=True)
        return Response(self.get_serializer(cliente).data)
