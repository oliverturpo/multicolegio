from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db import connection
from django.db.models import Q
from asistencia.permissions import GestionAlumnos
from .models import Apoderado, GradoSeccion, Alumno
from .serializers import ApoderadoSerializer, GradoSeccionSerializer, AlumnoSerializer, AlumnoListSerializer
from .carnet import generar_pdf_carnets


class ApoderadoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, GestionAlumnos]
    serializer_class   = ApoderadoSerializer

    def get_queryset(self):
        qs = Apoderado.objects.all()
        buscar = self.request.query_params.get('buscar')
        if buscar:
            qs = qs.filter(
                Q(dni__icontains=buscar) |
                Q(nombres__icontains=buscar) |
                Q(apellido_paterno__icontains=buscar)
            )
        return qs


class GradoSeccionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, GestionAlumnos]
    serializer_class   = GradoSeccionSerializer

    def get_queryset(self):
        qs = GradoSeccion.objects.all()
        año = self.request.query_params.get('año')
        if año:
            qs = qs.filter(año_academico=año)
        return qs.order_by('grado', 'nombre_seccion')


class AlumnoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, GestionAlumnos]

    def get_serializer_class(self):
        if self.action == 'list':
            return AlumnoListSerializer
        return AlumnoSerializer

    def get_queryset(self):
        qs = Alumno.objects.select_related('grado_seccion', 'apoderado').filter(estado='ACTIVO')
        grado   = self.request.query_params.get('grado')
        seccion = self.request.query_params.get('seccion')
        buscar  = self.request.query_params.get('buscar')

        if grado:
            qs = qs.filter(grado_seccion__grado=grado)
        if seccion:
            qs = qs.filter(grado_seccion__nombre_seccion__icontains=seccion)
        if buscar:
            qs = qs.filter(
                Q(dni__icontains=buscar) |
                Q(nombres__icontains=buscar) |
                Q(apellido_paterno__icontains=buscar) |
                Q(apellido_materno__icontains=buscar) |
                Q(codigo_barras__icontains=buscar)
            )
        return qs

    @action(detail=False, methods=['get'], url_path='por-codigo/(?P<codigo>[^/.]+)')
    def por_codigo(self, request, codigo=None):
        """Busca alumno por código de barras — usado al escanear."""
        try:
            alumno = Alumno.objects.select_related('grado_seccion', 'apoderado').get(
                codigo_barras=codigo, estado='ACTIVO'
            )
            return Response(AlumnoListSerializer(alumno, context={'request': request}).data)
        except Alumno.DoesNotExist:
            return Response({'error': 'Alumno no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='historial')
    def historial(self, request, pk=None):
        """Historial de asistencias de un alumno con estadísticas."""
        alumno = self.get_object()
        asistencias = alumno.asistencias.order_by('-fecha')

        total    = asistencias.count()
        presente = asistencias.filter(estado='PRESENTE').count()
        tardanza = asistencias.filter(estado='TARDANZA').count()
        ausente  = asistencias.filter(estado='AUSENTE').count()
        justif   = asistencias.filter(estado='JUSTIFICADO').count()

        data = {
            'alumno': AlumnoListSerializer(alumno, context={'request': request}).data,
            'estadisticas': {
                'total': total,
                'presentes':   presente,
                'tardanzas':   tardanza,
                'ausentes':    ausente,
                'justificados': justif,
                'porcentaje':  round((presente / total * 100), 1) if total else 0,
            },
            'registros': [
                {
                    'fecha':         a.fecha,
                    'estado':        a.estado,
                    'hora_registro': a.hora_registro,
                    'metodo':        a.metodo,
                }
                for a in asistencias[:60]
            ],
        }
        return Response(data)

    @action(detail=True, methods=['get'], url_path='carnet')
    def carnet(self, request, pk=None):
        """PDF con el carnet del alumno (1 por página)."""
        try:
            alumno = Alumno.objects.select_related('grado_seccion', 'apoderado').get(pk=pk)
        except Alumno.DoesNotExist:
            return Response({'error': 'Alumno no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        _t     = connection.tenant
        _logo  = _t.logo.path if getattr(_t, 'logo', None) else None
        pdf    = generar_pdf_carnets([alumno], institucion=getattr(_t, 'nombre', ''), logo_path=_logo)
        nombre = f"carnet_{alumno.dni}.pdf"
        return HttpResponse(
            pdf,
            content_type='application/pdf',
            headers={'Content-Disposition': f'inline; filename="{nombre}"'},
        )

    @action(detail=False, methods=['get'], url_path='carnets-seccion')
    def carnets_seccion(self, request):
        """PDF con carnets de todos los alumnos de una sección (4 por hoja)."""
        grado_id = request.query_params.get('grado_id')
        if not grado_id:
            return Response({'error': 'Se requiere grado_id.'}, status=status.HTTP_400_BAD_REQUEST)
        alumnos = (
            Alumno.objects
            .select_related('grado_seccion', 'apoderado')
            .filter(grado_seccion_id=grado_id, estado='ACTIVO')
            .order_by('apellido_paterno', 'apellido_materno', 'nombres')
        )
        if not alumnos.exists():
            return Response({'error': 'No hay alumnos activos en esta sección.'}, status=status.HTTP_404_NOT_FOUND)
        _t     = connection.tenant
        _logo  = _t.logo.path if getattr(_t, 'logo', None) else None
        pdf    = generar_pdf_carnets(list(alumnos), institucion=getattr(_t, 'nombre', ''), logo_path=_logo)
        nombre = f"carnets_seccion_{grado_id}.pdf"
        return HttpResponse(
            pdf,
            content_type='application/pdf',
            headers={'Content-Disposition': f'inline; filename="{nombre}"'},
        )
