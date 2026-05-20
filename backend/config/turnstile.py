"""
Verificación server-side de Cloudflare Turnstile.

Sin dependencias externas (urllib stdlib). Comportamiento:
- Si `TURNSTILE_SECRET` está vacío (desarrollo): se omite (retorna True).
- Si está configurado: valida contra Cloudflare y FALLA CERRADO
  (cualquier error de red o token inválido → False).
"""
import json
import urllib.parse
import urllib.request

from django.conf import settings

VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'


def verificar_turnstile(token: str, remote_ip: str | None = None) -> bool:
    secret = getattr(settings, 'TURNSTILE_SECRET', '') or ''
    if not secret:
        return True  # dev: validación desactivada
    if not token:
        return False

    payload = {'secret': secret, 'response': token}
    if remote_ip:
        payload['remoteip'] = remote_ip

    try:
        req = urllib.request.Request(
            VERIFY_URL,
            data=urllib.parse.urlencode(payload).encode(),
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode())
        return bool(result.get('success'))
    except Exception:
        return False
