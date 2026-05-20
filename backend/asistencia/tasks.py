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
    with schema_context(schema_name):
        from .models import SesionDiaria, Asistencia

        try:
            sesion = SesionDiaria.objects.get(id=sesion_id)
        except SesionDiaria.DoesNotExist:
            return

        if sesion.whatsapp_enviados:
            return

        asistencias = Asistencia.objects.filter(
            sesion=sesion,
            estado__in=[Asistencia.Estado.TARDANZA, Asistencia.Estado.AUSENTE],
            whatsapp_enviado=False,
        ).select_related('alumno__apoderado')

        mensajes = {
            'TARDANZA': '{nombre} llego tarde a clases hoy {fecha}.',
            'AUSENTE':  '{nombre} no asistio a clases hoy {fecha}. Comuniquese con el auxiliar.',
        }

        ids_enviados = []
        for asistencia in asistencias:
            alumno    = asistencia.alumno
            apoderado = alumno.apoderado
            telefono  = apoderado.telefono_whatsapp
            mensaje   = mensajes[asistencia.estado].format(
                nombre=alumno.nombre_completo,
                fecha=asistencia.fecha.strftime('%d/%m/%Y'),
            )

            # TODO: Integrar API de WhatsApp (Twilio / Meta Cloud API)
            # _enviar_whatsapp(telefono, mensaje)
            print(f'[WhatsApp][{schema_name}] → {telefono}: {mensaje}')

            ids_enviados.append(asistencia.id)

        Asistencia.objects.filter(id__in=ids_enviados).update(whatsapp_enviado=True)
        sesion.whatsapp_enviados = True
        sesion.save(update_fields=['whatsapp_enviados'])
