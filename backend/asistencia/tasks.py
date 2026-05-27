from celery import shared_task
from django_tenants.utils import schema_context


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
