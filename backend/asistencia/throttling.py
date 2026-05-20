from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class EscaneoThrottle(UserRateThrottle):
    """Máximo 120 escaneos por minuto por usuario (2/seg).
    Protege contra lectoras defectuosas o ataques de fuerza bruta."""
    scope = 'escaneo'


class LoginThrottle(AnonRateThrottle):
    """Limita intentos de login a usuarios anónimos."""
    scope = 'login'
