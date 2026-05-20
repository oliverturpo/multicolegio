from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from asistencia.permissions import EsDirector, UsuarioActivo
from .models import UsuarioSistema
from .serializers import (
    UsuarioSistemaSerializer, CrearUsuarioSerializer,
    EditarUsuarioSerializer, YachayQRTokenSerializer,
)


class YachayQRTokenView(TokenObtainPairView):
    """Login JWT personalizado — devuelve rol y nombre junto con los tokens."""
    serializer_class = YachayQRTokenSerializer


class UsuarioSistemaViewSet(viewsets.ModelViewSet):
    serializer_class = UsuarioSistemaSerializer

    def get_permissions(self):
        # `yo`: cualquier usuario autenticado y activo (su propio perfil).
        # Todo lo demás (listar/ver/crear/editar/borrar personal): solo Director.
        if self.action == 'yo':
            return [IsAuthenticated(), UsuarioActivo()]
        return [IsAuthenticated(), EsDirector()]

    def get_serializer_class(self):
        if self.action == 'create':
            return CrearUsuarioSerializer
        if self.action in ('update', 'partial_update'):
            return EditarUsuarioSerializer
        return UsuarioSistemaSerializer

    def get_queryset(self):
        qs = UsuarioSistema.objects.select_related('user').order_by('user__first_name')
        rol = self.request.query_params.get('rol')
        if rol:
            qs = qs.filter(rol=rol)
        return qs

    def update(self, request, *args, **kwargs):
        perfil = self.get_object()
        # Director no puede editarse el rol a sí mismo (seguridad)
        if perfil.user == request.user and 'rol' in request.data:
            return Response(
                {'error': 'No puedes cambiar tu propio rol.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(perfil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UsuarioSistemaSerializer(perfil).data)

    def destroy(self, request, *args, **kwargs):
        perfil = self.get_object()
        if perfil.user == request.user:
            return Response(
                {'error': 'No puedes eliminar tu propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        perfil.user.delete()  # Cascade elimina UsuarioSistema también
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='yo', permission_classes=[IsAuthenticated])
    def yo(self, request):
        """Perfil del usuario autenticado."""
        try:
            return Response(UsuarioSistemaSerializer(request.user.perfil).data)
        except UsuarioSistema.DoesNotExist:
            return Response({'error': 'Sin perfil asignado'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='toggle-activo')
    def toggle_activo(self, request, pk=None):
        """Activa o desactiva un usuario. Director no puede desactivarse a sí mismo."""
        perfil = self.get_object()
        if perfil.user == request.user:
            return Response(
                {'error': 'No puedes desactivar tu propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        perfil.activo = not perfil.activo
        perfil.save(update_fields=['activo'])
        return Response(UsuarioSistemaSerializer(perfil).data)
