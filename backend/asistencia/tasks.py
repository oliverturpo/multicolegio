from celery import shared_task
from django_tenants.utils import schema_context


@shared_task
def cerrar_sesiones_expiradas():
    """
    Corre cada 5 min (Celery Beat). Cierra sesiones cuyo hora_cierre ya
    pasó: marca ausentes a los sin registro, actualiza contadores y encola
    el envío de WhatsApp.
    """
    from django.utils import timezone
    from tenants.models import Cliente

    now_lima = timezone.localtime(timezone.now())
    hora_actual = now_lima.time()
    fecha_hoy = now_lima.date()

    schemas = list(
        Cliente.objects.exclude(schema_name='public')
        .values_list('schema_name', flat=True)
    )

    for schema in schemas:
        with schema_context(schema):
            from .models import SesionDiaria, Asistencia
            from colegios.models import Alumno

            sesiones = SesionDiaria.objects.filter(
                estado=SesionDiaria.Estado.ABIERTA,
                fecha=fecha_hoy,
                horario__hora_cierre__lte=hora_actual,
            )

            for sesion in sesiones:
                registrados = set(
                    Asistencia.objects.filter(fecha=sesion.fecha)
                    .values_list('alumno_id', flat=True)
                )

                sin_registro = Alumno.objects.filter(
                    estado=Alumno.Estado.ACTIVO
                ).exclude(id__in=registrados)

                nuevas = [
                    Asistencia(
                        sesion=sesion,
                        alumno=alumno,
                        fecha=sesion.fecha,
                        estado=Asistencia.Estado.AUSENTE,
                        metodo=Asistencia.MetodoRegistro.AUTOMATICO,
                    )
                    for alumno in sin_registro
                ]
                if nuevas:
                    Asistencia.objects.bulk_create(nuevas, ignore_conflicts=True)

                sesion.estado = SesionDiaria.Estado.CERRADA
                sesion.hora_cierre_real = hora_actual
                sesion.save(update_fields=['estado', 'hora_cierre_real'])

                sesion.actualizar_contadores()

                enviar_whatsapp_sesion.delay(schema, sesion.id)


@shared_task
def enviar_whatsapp_sesion(schema_name, sesion_id):
    """
    Se ejecuta al cerrar una sesión. Envía WhatsApp a los apoderados de
    alumnos con tardanza o ausencia.

    IMPORTANTE: el worker de Celery NO tiene contexto de tenant. Hay que
    fijar el schema del colegio explícitamente con `schema_context`, o
    todas las consultas irían al schema `public` (donde estas tablas no
    existen) y la tarea fallaría.
    """
    from config.whatsapp import enviar_template

    with schema_context(schema_name):
        from .models import SesionDiaria, Asistencia
        from tenants.models import Cliente

        try:
            sesion = SesionDiaria.objects.get(id=sesion_id)
        except SesionDiaria.DoesNotExist:
            return

        if sesion.whatsapp_enviados:
            return

        # Plan WhatsApp: solo los colegios con whatsapp_activo=True reciben
        # notificaciones. Si no lo tienen, se omite el envío silenciosamente.
        try:
            colegio = Cliente.objects.get(schema_name=schema_name)
        except Cliente.DoesNotExist:
            return
        if not colegio.whatsapp_activo:
            return
        nombre_colegio = colegio.nombre

        asistencias = Asistencia.objects.filter(
            sesion=sesion,
            estado__in=[Asistencia.Estado.TARDANZA, Asistencia.Estado.AUSENTE],
            whatsapp_enviado=False,
        ).select_related('alumno__apoderado')

        # Template → (nombre_template, [param1, param2, param3])
        # Parámetros según los templates aprobados en Meta:
        #   yachayqr_ausente:  {{1}}=alumno  {{2}}=fecha  {{3}}=colegio
        #   yachayqr_tardanza: {{1}}=alumno  {{2}}=fecha  {{3}}=hora
        ids_enviados = []
        for asistencia in asistencias:
            alumno    = asistencia.alumno
            apoderado = alumno.apoderado
            if not apoderado or not apoderado.telefono_whatsapp:
                continue

            fecha_str = asistencia.fecha.strftime('%d/%m/%Y')

            if asistencia.estado == Asistencia.Estado.AUSENTE:
                ok = enviar_template(
                    apoderado.telefono_whatsapp,
                    'yachayqr_ausente',
                    [alumno.nombre_completo, fecha_str, nombre_colegio],
                )
            else:  # TARDANZA
                hora_str = asistencia.hora_registro.strftime('%H:%M') if asistencia.hora_registro else '—'
                ok = enviar_template(
                    apoderado.telefono_whatsapp,
                    'yachayqr_tardanza',
                    [alumno.nombre_completo, fecha_str, hora_str],
                )

            if ok:
                ids_enviados.append(asistencia.id)

        if ids_enviados:
            Asistencia.objects.filter(id__in=ids_enviados).update(whatsapp_enviado=True)

        sesion.whatsapp_enviados = True
        sesion.save(update_fields=['whatsapp_enviados'])
