import json
import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

logger = logging.getLogger('whatsapp.webhook')


@csrf_exempt
def whatsapp_webhook(request):
    # Verificación del webhook (handshake de Meta).
    if request.method == 'GET':
        mode = request.GET.get('hub.mode')
        token = request.GET.get('hub.verify_token')
        challenge = request.GET.get('hub.challenge')
        if mode == 'subscribe' and token == settings.WHATSAPP_VERIFY_TOKEN:
            return HttpResponse(challenge)
        return HttpResponse(status=403)

    # POST: eventos de estado (sent/delivered/read/failed) y mensajes entrantes.
    try:
        payload = json.loads(request.body.decode() or '{}')
        for entry in payload.get('entry', []):
            for change in entry.get('changes', []):
                value = change.get('value', {})
                for st in value.get('statuses', []):
                    logger.warning(
                        '[WA-STATUS] id=%s status=%s recipient=%s errors=%s',
                        st.get('id'), st.get('status'),
                        st.get('recipient_id'), st.get('errors'),
                    )
                for msg in value.get('messages', []):
                    logger.warning(
                        '[WA-INBOUND] from=%s type=%s', msg.get('from'), msg.get('type'),
                    )
    except Exception as e:  # nunca romper el 200: Meta reintenta si falla
        logger.error('[WA-WEBHOOK] error parseando payload: %s', e)

    return HttpResponse(status=200)
