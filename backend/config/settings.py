from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost').split(',')

# --- Multi-tenancy (django-tenants) ---
# Apps compartidas (schema public): plataforma + superusuario/admin.
SHARED_APPS = [
    'django_tenants',
    'tenants',

    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.admin',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
]

# Apps privadas de cada colegio (su propio schema).
# auth + contenttypes + token_blacklist van también aquí para que cada
# colegio tenga su PROPIA tabla de usuarios (aislamiento real). El login
# ocurre en contexto de tenant, así que resuelve contra el schema correcto.
TENANT_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework_simplejwt.token_blacklist',

    'colegios',
    'asistencia',
    'usuarios',
]

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

TENANT_MODEL = 'tenants.Cliente'
TENANT_DOMAIN_MODEL = 'tenants.Dominio'

# --- Middleware ---
MIDDLEWARE = [
    'django_tenants.middleware.main.TenantMainMiddleware',  # debe ser el primero
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
# django-tenants: el schema public usa este urlconf (panel del dueño).
# Los colegios (tenants) usan ROOT_URLCONF.
PUBLIC_SCHEMA_URLCONF = 'config.urls_public'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# --- Base de datos PostgreSQL ---
DATABASES = {
    'default': {
        'ENGINE': 'django_tenants.postgresql_backend',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

DATABASE_ROUTERS = ['django_tenants.routers.TenantSyncRouter']

# --- CORS (permite que React se comunique con Django) ---
# Host base (panel del dueño y atajo demo).
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
]
# Cada colegio se abre en su propio subdominio (mgcj.localhost:5173 en
# dev, colegio.yachayqr.pe en prod). Sin esto, el navegador bloquea por
# CORS la llamada del frontend del colegio a su propia API.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^http://[a-z0-9-]+\.localhost:(5173|5174)$',
    r'^https://[a-z0-9-]+\.yachayqr\.pe$',
]

# --- Django REST Framework ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user':    '300/min',   # límite general por usuario autenticado
        'anon':    '20/min',    # límite para no autenticados
        'escaneo': '120/min',   # máx 2 escaneos/seg — protege contra lectoras defectuosas
        'login':   '10/min',    # protege el endpoint de login
    },
}

# --- JWT ---
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=60),   # corto: desactivar usuario surte efecto pronto
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# --- URL de acceso del colegio (lo que se le muestra al Director) ---
# Apunta al FRONTEND (React), NO al backend :8000. {sub} = subdominio.
# Prod: TENANT_LOGIN_URL_TEMPLATE=https://{sub}.yachayqr.pe/login
TENANT_LOGIN_URL_TEMPLATE = config(
    'TENANT_LOGIN_URL_TEMPLATE',
    default='http://{sub}.localhost:5173/login',
)

# --- Cloudflare Turnstile (anti-bot en login y registro) ---
# Si TURNSTILE_SECRET está vacío (dev), la validación se omite.
TURNSTILE_SECRET = config('TURNSTILE_SECRET', default='')

# --- Password validation ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- Internacionalización ---
LANGUAGE_CODE = 'es-pe'
TIME_ZONE = 'America/Lima'
USE_I18N = True
USE_TZ = True

# --- Archivos estáticos y media ---
STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Celery ---
CELERY_BROKER_URL         = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND     = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_TIMEZONE           = 'America/Lima'
CELERY_TASK_TRACK_STARTED = True
