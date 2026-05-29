# YachayQR

SaaS de control de asistencia escolar por escaneo del DNI del alumno (que funciona como código de barras y QR). Reemplaza el pase de lista manual en papel: registra la entrada como **Presente** o **Tardanza** según la hora, marca **Ausente** a quienes no asisten, notifica a los apoderados por WhatsApp, gestiona justificaciones con límite y detecta intentos de fraude (DNI digitado a mano).

Es **multi-colegio**: cada institución es un inquilino (*tenant*) aislado, con su propio subdominio y base de datos lógica.

- Producción: **https://yachayqr.com**
- Demo (datos reales del IES Túpac Amaru): **https://demo.yachayqr.com**

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5 · Django REST Framework · django-tenants · SimpleJWT · Celery + Redis |
| Frontend | React · Vite · React Router v6 |
| Base de datos | PostgreSQL (un *schema* por colegio) |
| Infraestructura | DigitalOcean (Ubuntu) · Nginx · Gunicorn · Let's Encrypt (SSL wildcard) |
| Servicios externos | Cloudflare (DNS wildcard + Turnstile) · Meta WhatsApp Cloud API |

## Arquitectura multi-tenant

Se usa **django-tenants** con aislamiento por *schema* de PostgreSQL:

- El schema `public` aloja la plataforma y el superusuario dueño (alta/suspensión de colegios).
- Cada colegio tiene su propio schema con su **propia tabla `auth_user`** (aislamiento real de usuarios). El login ocurre en contexto de tenant, por lo que resuelve contra el colegio correcto.
- El subdominio (`sanmarcos.yachayqr.com`) identifica al tenant vía la cabecera `Host`, que procesa `TenantMainMiddleware`. En dev se usa `127.0.0.1:8000` → schema `demo`.
- El alta de un colegio crea `Cliente` (schema) + `Dominio` + el usuario **Director** inicial dentro de su schema.
- `CorsMiddleware` va **antes** que `TenantMainMiddleware`: así el 404 de "colegio no encontrado" sale con cabeceras CORS y el frontend lo interpreta bien.

## Roles del sistema

Los roles viven dentro de cada colegio (`usuarios.UsuarioSistema`); el dueño de la plataforma es un superusuario del schema `public`.

| Rol | Permisos principales |
|-----|----------------------|
| **Dueño plataforma** | Alta/suspensión de colegios; activar Plan Premium (WhatsApp). Schema `public`. |
| **Director** | Control total del colegio: usuarios, alumnos, horario, reportes, justificar, cerrar sesión. |
| **Auxiliar** | Escanea; gestiona alumnos; cambia Tardanza→Presente (solo el mismo día); justifica; cierra sesión. |
| **Psicólogo** | Consulta alumnos/historial (solo lectura) y gestiona justificaciones. |
| **Escáner** | Dispositivo físico: solo escanea, sin acceso a datos. |

## Setup local

**Requisitos:** Python 3.12+, Node 18+, PostgreSQL, Redis.

```bash
# Backend (terminal 1)
cd backend
python -m venv venv
source venv/Scripts/activate        # Windows; en Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # editar credenciales (ver tabla de variables)
python manage.py migrate_schemas
python manage.py runserver 0.0.0.0:8000
```

```bash
# Frontend (terminal 2)
cd frontend
npm install
cp .env.example .env.local           # apunta a http://127.0.0.1:8000/api
npm run dev                          # → http://localhost:5174
```

En desarrollo, usar **`127.0.0.1:8000`** (resuelve al schema `demo`). Usuarios de prueba del schema demo:

| usuario | contraseña | rol |
|---------|-----------|-----|
| director | demo1234 | DIRECTOR |
| auxiliar | demo1234 | AUXILIAR |
| psicologo | demo1234 | PSICOLOGO |
| escaner | demo1234 | ESCANER |

## Deploy en producción

Servidor DigitalOcean (`64.23.175.14`), código en `/var/www/yachayqr/`. Nginx sirve `frontend/dist/` y hace proxy de `/api/` a Gunicorn (`127.0.0.1:8000`).

```bash
# En el servidor, tras 'git push origin main' desde la laptop:
git pull origin main
systemctl restart yachayqr yachayqr-celery          # si cambió backend
cd backend && source venv/bin/activate && python manage.py migrate_schemas   # si hubo migraciones
cd frontend && npm run build                        # si cambió frontend
```

| Dominio | Schema | Notas |
|---------|--------|-------|
| `yachayqr.com` | `public` | Panel del dueño (superusuario `sicoa`). |
| `demo.yachayqr.com` | `demo` | Colegio demo con dataset real (233 alumnos). |
| `iestacoasa.yachayqr.com` | `iestacoasa` | Primer colegio real (IESTA-COASA). |

## Variables de entorno

Definidas en `backend/.env` (no se versiona). El `.env` de prod vive solo en el servidor.

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave secreta de Django. |
| `DEBUG` | `True` en dev, `False` en prod. |
| `ALLOWED_HOSTS` | Hosts permitidos, separados por coma (ej. `.yachayqr.com,yachayqr.com`). |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Credenciales de PostgreSQL. |
| `DB_HOST` / `DB_PORT` | Host y puerto de la BD (default `localhost:5432`). |
| `REDIS_URL` | Broker de Celery (default `redis://localhost:6379/0`). |
| `TENANT_DOMAIN_SUFFIX` | Sufijo de los subdominios de colegio. Dev: `localhost`; prod: `yachayqr.com`. |
| `TENANT_LOGIN_URL_TEMPLATE` | Plantilla de la URL de acceso del colegio (apunta al frontend). |
| `TURNSTILE_SECRET` | Secreto de Cloudflare Turnstile. Vacío = se omite la validación. |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | Credenciales de Meta WhatsApp Cloud API. |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación del webhook de WhatsApp. |

## Estructura del repositorio

```
SaaS/
├── backend/
│   ├── config/        # settings, urls, wsgi, Celery, Turnstile, WhatsApp
│   ├── tenants/       # Cliente (colegio/schema) + Dominio + panel del dueño
│   ├── colegios/      # Alumno, Apoderado, GradoSeccion, carnet PDF
│   ├── asistencia/    # Horario, Sesión, Asistencia, justificaciones, escaneo, reportes, tasks
│   ├── usuarios/      # UsuarioSistema (roles) + login JWT
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/       # vistas por rol (escáner, alumnos, reportes, etc.)
│   │   ├── components/  # UI reutilizable (Layout, etc.)
│   │   ├── context/     # estado global (auth)
│   │   ├── services/    # cliente HTTP a la API
│   │   └── router/      # rutas de React Router
│   ├── package.json
│   └── vite.config.js
└── CLAUDE.md          # notas internas del proyecto
```
