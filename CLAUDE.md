# YachayQR — SaaS de control de asistencia escolar

## Stack
- **Backend**: Django 5 + django-tenants + DRF + simplejwt + Celery/Redis | `F:/SaaS/backend/`
- **Frontend**: React + Vite + React Router v6 | `F:/SaaS/frontend/`
- **DB**: PostgreSQL — schema por colegio (multi-tenancy)

## Levantar en desarrollo

```bash
# Backend (terminal 1)
cd F:/SaaS/backend && source venv/Scripts/activate
python manage.py runserver 0.0.0.0:8000

# Frontend (terminal 2)
cd F:/SaaS/frontend
npm run dev
# → http://localhost:5174
```

**IMPORTANTE — Windows:** Si hay errores de "puerto en uso", matar todos los procesos en 8000 con PowerShell:
```powershell
Get-Process -Id (netstat -ano | Select-String ":8000").toString().trim().split()[-1] | Stop-Process -Force
```

## Tenant de desarrollo
- `localhost:8000` → schema `public`
- `127.0.0.1:8000` → schema `demo` ← **usar este para desarrollo**
- Frontend apunta a `http://127.0.0.1:8000/api` via `frontend/.env.local`

## Usuarios de prueba (schema demo)
| usuario | contraseña | rol |
|---------|-----------|-----|
| director | demo1234 | DIRECTOR |
| auxiliar | demo1234 | AUXILIAR |
| psicologo | demo1234 | PSICOLOGO |
| escaner | demo1234 | ESCANER |

Recrear si se borra la BD:
```bash
python manage.py shell -c "
from django_tenants.utils import tenant_context
from tenants.models import Cliente
from django.contrib.auth.models import User
from usuarios.models import UsuarioSistema
demo = Cliente.objects.get(schema_name='demo')
with tenant_context(demo):
    for u,f,l,r in [('director','Director','Demo','DIRECTOR'),('auxiliar','Auxiliar','Demo','AUXILIAR'),('psicologo','Psicologo','Demo','PSICOLOGO'),('escaner','Escaner','Demo','ESCANER')]:
        usr,_ = User.objects.get_or_create(username=u)
        usr.set_password('demo1234'); usr.first_name=f; usr.last_name=l; usr.save()
        UsuarioSistema.objects.update_or_create(user=usr, defaults={'rol':r,'activo':True})
"
```

> El schema `demo` (local y prod) contiene el dataset real del **IES Tupac
> Amaru**: 233 alumnos + 1853 asistencias, importado con `migrar_tupac.py`
> (en la raíz del proyecto; lee `db_2026-05-20.sqlite3`, también en la raíz).
> El script conserva los 4 usuarios de prueba y reemplaza el resto de datos.

## Producción (yachayqr.com)

Servidor: **DigitalOcean** (`64.23.175.14`), Ubuntu, código en `/var/www/yachayqr/`.

### Dominios y tenants registrados en prod (BD)
| Dominio | Schema | Notas |
|---|---|---|
| `yachayqr.com` | `public` | Panel del dueño. Superuser: `sicoa`. |
| `demo.yachayqr.com` | `demo` | Colegio de prueba. Tiene el dataset real del IESTA Tupac Amaru (233 alumnos). |
| `iestacoasa.yachayqr.com` | `iestacoasa` | Primer colegio real (IESTA-COASA). Director inicial. |

- DNS wildcard: `*.yachayqr.com` → `64.23.175.14`.
- SSL: Let's Encrypt wildcard cubre `*.yachayqr.com` + `yachayqr.com` (`/etc/letsencrypt/live/yachayqr.com/`).
- El `Cliente(schema_name='public')` y el `Dominio('yachayqr.com')` se crearon manualmente (django-tenants no los crea solo). Si se reconstruye la BD, **hay que recrearlos** además de los tenants normales.

### Servicios (systemd) y comandos comunes
| Servicio | Qué hace | Reiniciar |
|---|---|---|
| `yachayqr.service` | Gunicorn (Django) en `127.0.0.1:8000`, 3 workers | `systemctl restart yachayqr` |
| `yachayqr-celery.service` | Worker Celery (tareas async) | `systemctl restart yachayqr-celery` |
| `nginx` | Proxy + SSL + sirve `frontend/dist/` | `systemctl reload nginx` |

Nginx config: `/etc/nginx/sites-enabled/yachayqr`. Sirve `/api/` → `proxy_pass http://127.0.0.1:8000`; resto → SPA del `frontend/dist/`. El header `Host` se pasa intacto, por eso django-tenants resuelve el tenant correcto.

### Variables del `.env` de prod (`/var/www/yachayqr/backend/.env`)
```
DEBUG=False
ALLOWED_HOSTS=.yachayqr.com,yachayqr.com,64.23.175.14
TENANT_DOMAIN_SUFFIX=yachayqr.com               # sufijo de tenants nuevos (ver sección abajo)
TENANT_LOGIN_URL_TEMPLATE=https://{sub}.yachayqr.com/login
DB_NAME=yachayqr  /  DB_USER=yachayqr  /  DB_HOST=localhost
REDIS_URL=redis://localhost:6379/0
TURNSTILE_SECRET=                                # vacío = omite Turnstile
```
El `.env` está en `.gitignore` — no se sube a GitHub. El de dev (`F:/SaaS/backend/.env`) vive solo en la laptop.

### Workflow de despliegue (laptop → prod)
1. **En laptop** (`F:/SaaS/`): commitear + `git push origin main`
2. **En servidor** (`/var/www/yachayqr/`):
   ```bash
   git pull origin main
   # Si tocaste backend Python:
   systemctl restart yachayqr yachayqr-celery
   # Si añadiste migraciones:
   cd backend && source venv/bin/activate && python manage.py migrate_schemas
   # Si tocaste frontend:
   cd frontend && npm run build      # nginx ya sirve el dist/
   ```

### SSH deploy key (servidor ↔ GitHub)
El servidor pushea/pullea por SSH con la deploy key `~/.ssh/yachayqr_deploy` (configurada en `~/.ssh/config` para `github.com`). La pública está registrada en GitHub → repo `oliverturpo/multicolegio` → Settings → Deploy keys (con write access). Remote: `git@github.com:oliverturpo/multicolegio.git`.

## Arquitectura multi-tenant
- Registro de colegio → crea `Cliente` (schema propio) + `Dominio` + Director inicial (en su schema)
- `SHARED_APPS`: tenants, contenttypes, **auth**, admin, sessions, simplejwt, token_blacklist (schema `public` = superusuario/plataforma)
- `TENANT_APPS`: contenttypes, **auth**, token_blacklist, colegios, asistencia, usuarios
- **Los usuarios son por colegio**: `auth_user` vive en cada schema de tenant (aislamiento real). El login ocurre en contexto de tenant, así resuelve contra el `auth_user` del colegio correcto.
- JWT personalizado (`YachayQRTokenSerializer`) embebe `rol` y `nombre_completo`; access token = 60 min
- Turnstile se valida en el backend (`config/turnstile.py`); en dev se omite si `TURNSTILE_SECRET` está vacío

### Migración a usuarios por-tenant — HECHA (2026-05-17)
Ya ejecutada y verificada: `public` conserva el superusuario; `demo` tiene su propio `auth_user` con los 4 usuarios. **Ojo:** para un schema viejo creado cuando `auth` era SHARED, `migrate_schemas` es no-op (su `django_migrations` ya marca `auth` aplicada aunque la tabla no exista). Si hay que reconstruir `demo` (o cualquier tenant en ese estado), recrear el schema:
```python
# manage.py shell  (venv Windows activo)
from django.db import connection
from tenants.models import Cliente, Dominio
with connection.cursor() as c: c.execute('DROP SCHEMA IF EXISTS demo CASCADE')
Cliente.objects.filter(schema_name='demo').delete()
demo = Cliente(schema_name='demo', nombre='Colegio Demo YachayQR', email_contacto='demo@yachayqr.pe'); demo.save()
Dominio.objects.create(domain='demo.localhost', tenant=demo, is_primary=True)
Dominio.objects.create(domain='127.0.0.1', tenant=demo, is_primary=False)
# luego correr el snippet 'Recrear si se borra la BD' de abajo (crea los usuarios en demo)
```

### Dominio de tenant configurable — HECHA (2026-05-20)
Antes el alta de colegio en `tenants/views.py` hardcodeaba `<subdominio>.localhost`, lo que rompía prod (django-tenants no resolvía el host real). Ahora compone el dominio con `settings.TENANT_DOMAIN_SUFFIX`:
- **Dev** (variable ausente en `.env`): default `'localhost'` → crea `mgcj.localhost` (igual que antes)
- **Prod** (`TENANT_DOMAIN_SUFFIX=yachayqr.com`): crea `mgcj.yachayqr.com` automáticamente

Cero impacto en flujo de desarrollo. Para colegios viejos creados antes del fix con dominio `.localhost` en prod, hay que renombrar en BD:
```python
from tenants.models import Dominio
d = Dominio.objects.get(domain='<sub>.localhost'); d.domain = '<sub>.yachayqr.com'; d.save()
```

### Subdominio sin colegio + orden de middleware — HECHA (2026-05-21)
Cuando el host no corresponde a ningún colegio (ej. `wadas.yachayqr.com`):
- `settings.DEFAULT_NOT_FOUND_TENANT_VIEW` → `config.views.tenant_no_encontrado`
  devuelve `404 {"detail": "Colegio no encontrado"}` (JSON) en vez de Http404 HTML.
- `GET /api/v1/auth/verify-tenant/` (`config.views.verify_tenant`): 200 si el
  colegio existe, 404 si es el schema `public`. `Login.jsx` la llama al montar
  y, ante un 404, muestra la pantalla "Colegio no encontrado" en vez del form.
- **`CorsMiddleware` va ANTES de `TenantMainMiddleware`** en `MIDDLEWARE`. Es
  obligatorio: TenantMainMiddleware genera ese 404 él mismo y corta la cadena;
  si CorsMiddleware fuera después nunca correría y el 404 saldría sin cabeceras
  CORS — el navegador lo bloquearía (en dev, donde frontend y API son
  cross-origin) y el frontend lo vería como error de red, no como 404.

## Modelos clave
```
tenants:     Cliente (colegio/schema; whatsapp_activo = Plan Premium) → Dominio
colegios:    GradoSeccion → Alumno → Apoderado (whatsapp)
asistencia:  HorarioEscolar → SesionDiaria → Asistencia
             ContadorJustificacion (límite 3) → Notificacion
             IngresoManual (anti-fraude)
usuarios:    UsuarioSistema (rol: DIRECTOR|AUXILIAR|PSICOLOGO|ESCANER)
```

## Paleta de colores (usar en todo el frontend)
```css
--navy:      #0f2a4c   /* sidebar, fondo oscuro */
--navy-mid:  #1e3a5f   /* hover, botones */
--gold:      #fbbf24   /* acento, activo */
--gold-dark: #f59e0b
--bg:        #f8fafc   /* fondo claro */
--border:    #e2e8f0
```
Referencia: `frontend/src/components/Layout/Layout.css`

## Rutas del frontend
```
/login                       → Login (público)
/director/dashboard          → Dashboard con stats
/director/escaner            → Escáner
/director/alumnos            → CRUD alumnos + carnet
/director/asistencias        → Lista asistencias
/director/reportes           → Exportar Excel/PDF
/director/usuarios           → Gestión de usuarios
/auxiliar/escaner            → Escáner (pantalla principal)
/auxiliar/asistencias        → Lista asistencias
/auxiliar/alumnos            → Consulta alumnos
/psicologo/justificaciones   → Gestionar justificaciones
/psicologo/alumnos           → Consulta alumnos
/escaner                     → Pantalla bare (solo dispositivo físico)

/plataforma/login            → Login del DUEÑO (superusuario, schema public)
/plataforma/colegios         → Alta/suspensión de colegios (panel del dueño)
```
**Panel del dueño:** API en `localhost:8000/api/v1/plataforma/` (NO 127.0.0.1).
Login = superusuario de `public`. El `/api/v1/registro/` abierto fue eliminado.

## Estado actual — qué falta construir
Hechas: **Escáner** (input acepta solo DNI de 8 dígitos) y **Alumnos** (CRUD +
carnet PDF). Pendientes, en orden de prioridad:

1. **Dashboard Director** (`/director/dashboard`) — stats de sesión del día
2. **Justificaciones** — flujo psicólogo
3. **Reportes** — exportar Excel/PDF
4. **Usuarios** — CRUD usuarios del sistema

## Horario escolar (demo)
| Campo | Valor | Significado |
|-------|-------|-------------|
| hora_entrada | 07:30 | Se abre la sesión, alumnos empiezan a entrar |
| hora_limite_puntual | 08:00 | Después de esta hora = TARDANZA |
| hora_cierre | 09:00 | Se cierra, los sin registro = AUSENTE automático |
| dias_laborables | [0,1,2,3,4] | Lunes a viernes |

El horario es modificable por el Director desde `/director/dashboard` (próximamente).

## Lógica de negocio importante
- WhatsApp se envía al **cierre de sesión** (Celery task), no al escanear.
  Solo los colegios con `Cliente.whatsapp_activo=True` (Plan Premium) reciben
  notificaciones; si es `False`, `asistencia/tasks.py` omite el envío en silencio.
  El dueño activa/desactiva el plan desde el panel `/plataforma/colegios`.
- Solo el **Auxiliar** puede cambiar Tardanza → Justificado (no el Director)
- Límite de **3 justificaciones** por alumno; al llegar notifica al Director
- Anti-fraude: detectar entrada manual de DNI vs escáner (modelo `IngresoManual`)
- El código de barras / QR **es el DNI** del alumno (sin prefijo; el requisito "YQ"+DNI fue eliminado)
- Sección puede ser texto libre: "A", "B", "Albert Einstein"

## Configuración pendiente (requiere acción manual)
- [x] Cloudflare Turnstile: validado en backend (`config/turnstile.py`). Falta poner `TURNSTILE_SECRET` en `.env` para activarlo en prod (en dev se omite).
- [x] Carnet PDF: implementado en `colegios/carnet.py` (foto + barcode Code128 + QR, 4 por hoja). Falta solo el logo del colegio.
- [ ] WhatsApp API: la tarea `asistencia/tasks.py` ya es tenant-aware y solo envía a colegios con `whatsapp_activo=True`; el envío real está en `config/whatsapp.py`. Requiere worker Celery corriendo.

## Inconsistencias conocidas / a corregir
- **`config/settings.py:110`** — `CORS_ALLOWED_ORIGIN_REGEXES` apunta a `\.yachayqr\.pe$` pero el dominio real es `.com`. Hoy no rompe porque frontend y API comparten origen (vía nginx), pero es código stale. Cambiar `.pe` → `.com`.
- **`config/settings.py:148`** — comentario stale dice `colegio.yachayqr.pe` en la doc de `TENANT_LOGIN_URL_TEMPLATE`. Cambiar a `.com`.
- **`tenants/management/commands/crear_tenant_publico.py:21`** — el comando crea `domain='localhost'` hardcodeado. Para prod habría que parametrizarlo, o simplemente no usar este comando en prod (ya está hecho a mano).
- Migración pendiente: aplicar `migrate_schemas` después del fix de `TENANT_DOMAIN_SUFFIX` no es necesario (no toca modelos), pero si añades nuevos campos al `Dominio`, sí.

## Historial de fixes importantes
- **2026-05-21** — Migración de datos + 2 mejoras + fixes de UI:
  1. `migrar_tupac.py` (raíz del proyecto) importó el backup del IES Tupac Amaru
     al schema `demo` — 233 alumnos, 1853 asistencias. Lee `db_2026-05-20.sqlite3`
     de la raíz. Corrido en local y en prod.
  2. Mejora "Colegio no encontrado" para subdominios no registrados + orden de
     middleware (ver Arquitectura).
  3. Campo `Cliente.whatsapp_activo` (Plan Premium): toggle/checkbox en el panel
     del dueño + gate en `asistencia/tasks.py`. Migración `tenants/0002`.
  4. Escáner: el input solo acepta 8 dígitos (DNI).
  5. `/director/alumnos`: quitadas columnas Código/Estado; búsqueda por nombre
     completo con espacios (`Concat`, por palabra) y DNI; filtro por
     `GradoSeccion` exacta (id) en vez de por número de grado.
- **2026-05-17** — Migración a usuarios por-tenant (ver sección de Arquitectura).
- **2026-05-20** — Setup inicial de prod en yachayqr.com:
  1. Creado `Cliente(public)` + `Dominio('yachayqr.com')` en BD (no existían → 404 en `/api/v1/plataforma/`).
  2. Creado superuser `sicoa` en schema `public`.
  3. Corregido dominio del colegio `iestacoasa` (`iestacoasa.localhost` → `iestacoasa.yachayqr.com`).
  4. Fix del hardcode `.localhost` en `tenants/views.py` → ahora usa `TENANT_DOMAIN_SUFFIX`.
  5. Configurada SSH deploy key del servidor a GitHub.
  6. Commits `de9bf76` + `3519007` en `origin/main`.
