"""
Envío de mensajes WhatsApp vía Meta Cloud API (número compartido YachayQR).

Comportamiento:
- Si WHATSAPP_TOKEN o WHATSAPP_PHONE_ID están vacíos (dev): imprime en consola.
- En prod: POST al endpoint de Meta con el template aprobado.

Templates requeridos en Meta Business Manager:
  - yachayqr_ausente  → "{{1}} no asistió a clases hoy {{2}}. Comuníquese con {{3}}."
  - yachayqr_tardanza → "{{1}} llegó tarde a clases hoy {{2}}. Hora: {{3}}."

El teléfono debe incluir código de país sin '+': '51987654321'
"""
import json
import urllib.request
import urllib.error
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

API_URL = 'https://graph.facebook.com/v19.0/{phone_id}/messages'


def _activo():
    return bool(
        getattr(settings, 'WHATSAPP_TOKEN', '') and
        getattr(settings, 'WHATSAPP_PHONE_ID', '')
    )


def _telefono_e164(numero: str) -> str:
    """Normaliza el número a formato E.164 sin '+'. Agrega prefijo 51 (Perú) si no lo tiene."""
    numero = numero.strip().replace(' ', '').replace('-', '').lstrip('+')
    if not numero.startswith('51') and len(numero) == 9:
        numero = '51' + numero
    return numero


def enviar_template(telefono: str, template: str, params: list[str]) -> bool:
    """
    Envía un mensaje usando un template aprobado por Meta.

    Args:
        telefono: número del apoderado (con o sin prefijo de país)
        template: nombre del template ('yachayqr_ausente' | 'yachayqr_tardanza')
        params: lista de valores para los {{1}}, {{2}}, ... del template

    Returns:
        True si se envió correctamente, False en cualquier error.
    """
    if not _activo():
        logger.info('[WhatsApp][dev] → %s template=%s params=%s', telefono, template, params)
        return True  # en dev se simula éxito

    url = API_URL.format(phone_id=settings.WHATSAPP_PHONE_ID)
    payload = {
        'messaging_product': 'whatsapp',
        'to': _telefono_e164(telefono),
        'type': 'template',
        'template': {
            'name': template,
            'language': {'code': 'es'},
            'components': [{
                'type': 'body',
                'parameters': [
                    {'type': 'text', 'text': p} for p in params
                ],
            }],
        },
    }
    headers = {
        'Authorization': f'Bearer {settings.WHATSAPP_TOKEN}',
        'Content-Type': 'application/json',
    }
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers=headers,
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
        # Meta devuelve messages[0].id si fue exitoso
        return bool(result.get('messages'))
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        logger.error('[WhatsApp] HTTP %s: %s', e.code, body)
        return False
    except Exception as e:
        logger.error('[WhatsApp] Error inesperado: %s', e)
        return False
