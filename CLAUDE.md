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

Servidor: **DigitalOcean** (`137.184.236.181`), Ubuntu 24.04, SFO3, plan $6/mes (1GB RAM + 2GB swap), código en `/var/www/yachayqr/`.

> **Reconstruido el 2026-07-28.** El droplet viejo (`64.23.175.14`) se destruyó por saldo vencido. Todo se levantó de cero: repo clonado, Postgres/Redis/nginx, dataset Tupac reimportado desde `db_2026-05-20.sqlite3` (recuperado del historial de git), tenants `public`+`demo`, SSL y servicios systemd. Superuser dueño: `sicoa` / `Sicoa2026!`.

### Dominios y tenants registrados en prod (BD)
| Dominio | Schema | Notas |
|---|---|---|
| `yachayqr.com` | `public` | Panel del dueño. Superuser: `sicoa`. |
| `demo.yachayqr.com` | `demo` | Colegio de prueba. Dataset real IESTA Tupac Amaru (233 alumnos). |
| `iestacoasa.yachayqr.com` | `iestacoasa` | Primer colegio real (IESTA-COASA). |

- DNS (Cloudflare, "Solo DNS"): `yachayqr.com` y `*.yachayqr.com` → `137.184.236.181`.
- SSL: Let's Encrypt para `yachayqr.com` + `demo.yachayqr.com` (`/etc/letsencrypt/live/yachayqr.com/`). Renovación automática (certbot). **No es wildcard**: si se crea un colegio nuevo, agregar su subdominio con `certbot --nginx -d <sub>.yachayqr.com --expand`.
- El `Cliente(schema_name='public')` y el `Dominio('yachayqr.com')` se crearon manualmente. Si se reconstruye la BD, **hay que recrearlos**.

### Servicios (systemd) y comandos comunes
| Servicio | Qué hace | Reiniciar |
|---|---|---|
| `yachayqr.service` | Gunicorn (Django) en `127.0.0.1:8000`, 2 workers | `systemctl restart yachayqr` |
| `yachayqr-celery.service` | Worker Celery (tareas async, WhatsApp) | `systemctl restart yachayqr-celery` |
| `yachayqr-celery-beat.service` | Celery Beat (cierre automático de sesiones cada 5 min) | `systemctl restart yachayqr-celery-beat` |
| `nginx` | Proxy + SSL + sirve `frontend/dist/` | `systemctl reload nginx` |

Los 3 `.service` (gunicorn, celery, celery-beat) ya están creados y habilitados en el servidor nuevo (`/etc/systemd/system/`). Arrancan solos al bootear.

**Backup automático de la BD:** `/usr/local/bin/backup_yachayqr.sh` corre por cron diario a las 3AM → `pg_dump` gzip a `/var/backups/yachayqr/`, retiene 7 días.

Nginx config: `/etc/nginx/sites-enabled/yachayqr`. Sirve `/api/` → `proxy_pass http://127.0.0.1:8000`; resto → SPA del `frontend/dist/`. El header `Host` se pasa intacto.

### Variables del `.env` de prod (`/var/www/yachayqr/backend/.env`)
```
DEBUG=False
ALLOWED_HOSTS=.yachayqr.com,yachayqr.com,137.184.236.181
TENANT_DOMAIN_SUFFIX=yachayqr.com
TENANT_LOGIN_URL_TEMPLATE=https://{sub}.yachayqr.com/login
DB_NAME=yachayqr  /  DB_USER=yachayqr  /  DB_HOST=localhost
REDIS_URL=redis://localhost:6379/0
TURNSTILE_SECRET=                                # vacío = omite Turnstile
```
Con `DEBUG=False`, `CACHES` usa `RedisCache` (DB 1) automáticamente — el throttle de DRF se comparte entre todos los workers. En dev (DEBUG=True) usa `LocMemCache` sin necesitar Redis.

### Workflow de despliegue (laptop → prod)
1. **En laptop** (`F:/SaaS/`): commitear + `git push origin main`
2. **En servidor** (`/var/www/yachayqr/`):
   ```bash
   git pull origin main
   # Si tocaste backend Python:
   systemctl restart yachayqr yachayqr-celery yachayqr-celery-beat
   # Si añadiste migraciones:
   cd backend && source venv/bin/activate && python manage.py migrate_schemas
   # Si tocaste frontend:
   cd frontend && npm run build
   ```

### SSH deploy key (servidor ↔ GitHub)
Deploy key `~/.ssh/yachayqr_deploy` en servidor. Remote: `git@github.com:oliverturpo/multicolegio.git`.

## Arquitectura multi-tenant
- Registro de colegio → crea `Cliente` (schema propio) + `Dominio` + Director inicial (en su schema)
- `SHARED_APPS`: tenants, contenttypes, **auth**, admin, sessions, simplejwt, token_blacklist
- `TENANT_APPS`: contenttypes, **auth**, token_blacklist, colegios, asistencia, usuarios
- **Los usuarios son por colegio**: `auth_user` en cada schema. Login en contexto de tenant.
- JWT personalizado (`YachayQRTokenSerializer`) embebe `rol` y `nombre_completo`; access = 60 min
- Turnstile en `config/turnstile.py`; se omite si `TURNSTILE_SECRET` está vacío (dev)

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
/director/alumnos            → CRUD alumnos + carnet (paginación 100/página)
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

## Estado actual — todo construido ✅
- **Escáner** — escaneo DNI, apertura automática de sesión, anti-fraude
- **Alumnos** — CRUD + carnet PDF + paginación frontend (100/página, lazy loading fotos)
- **Asistencias** — listado con filtros
- **Reportes** — Excel/PDF con datos de apoderado y teléfono
- **Usuarios** — CRUD con roles, Director no puede editarse a sí mismo
- **Dashboard Director** — stats de sesión del día
- **Justificaciones** — flujo psicólogo con límite 3
- **Landing pública** — `yachayqr.com` (schema public)
- **Cierre automático de sesiones** — Celery Beat cada 5 min

## Horario escolar (demo)
| Campo | Valor | Significado |
|-------|-------|-------------|
| hora_entrada | 07:30 | Se abre la sesión, alumnos empiezan a entrar |
| hora_limite_puntual | 08:00 | Después de esta hora = TARDANZA |
| hora_cierre | 09:00 | Se cierra, los sin registro = AUSENTE automático |
| dias_laborables | [0,1,2,3,4] | Lunes a viernes |

## Lógica de negocio importante
- **Cierre automático**: `cerrar_sesiones_expiradas` (Celery Beat, cada 5 min) cierra sesiones cuyo `hora_cierre` ya pasó, crea AUSENTE para los sin registro y encola WhatsApp.
- WhatsApp se envía al **cierre de sesión** (Celery task). Solo colegios con `whatsapp_activo=True` reciben notificaciones.
- Solo **Director o Auxiliar** pueden justificar (PSICOLOGO también). Solo Auxiliar puede Tardanza→Presente el mismo día.
- Límite de **3 justificaciones** por alumno; al llegar notifica al Director.
- Anti-fraude: `IngresoManual` detecta DNI digitado a mano vs escáner.
- El código de barras / QR **es el DNI** del alumno (sin prefijo).
- Sección puede ser texto libre: "A", "B", "Albert Einstein".
- `AlumnoSerializer` valida DNI (8 dígitos numéricos) y campos de texto no vacíos en el servidor.

## Permisos HTTP por rol (tabla rápida)
| Endpoint | DIRECTOR | AUXILIAR | PSICOLOGO | ESCANER |
|---|---|---|---|---|
| Horarios GET | ✅ | ✅ | ✅ | ✅ |
| Horarios POST/PUT/PATCH/DELETE | ✅ | ❌ | ❌ | ❌ |
| Sesiones GET | ✅ | ✅ | ✅ | ✅ |
| Sesiones POST | ✅ | ✅ | ✅ | ✅ |
| Sesiones DELETE/PUT | ❌ (405) | ❌ (405) | ❌ (405) | ❌ (405) |
| Alumnos GET | ✅ | ✅ | ✅ | ❌ |
| Alumnos POST/PATCH | ✅ | ✅ | ❌ | ❌ |
| Alumnos DELETE | ✅ | ❌ (403) | ❌ | ❌ |
| Usuarios (listar/crear/editar) | ✅ | ❌ | ❌ | ❌ |
| Colegios DELETE | ❌ (405) | — | — | — |

## Arquitectura del escáner — puntos clave
- `EscaneoService.procesar()` corre en `transaction.atomic()`. Los dos lugares con `IntegrityError` (apertura de sesión + doble escaneo) usan savepoints internos (`with transaction.atomic()` anidado).
- `SesionDiaria.actualizar_contadores()` usa `queryset.update()` — un solo UPDATE SQL sin read-modify-write. Idempotente bajo carga concurrente.
- `CONN_MAX_AGE=60` en `DATABASES` — conexiones persistentes por worker.
- Throttle `EscaneoThrottle`: 120/min por usuario (compartido entre workers en prod gracias a Redis cache).

## Configuración pendiente (requiere acción manual)
- [x] **Celery Beat en servidor**: `.service` creado y habilitado en el droplet nuevo (2026-07-28).
- [ ] **Fotos de alumnos (demo)**: no estaban en el backup reimportado — recargar si se necesitan.
- [ ] **Colegio `iestacoasa`**: se perdió al reconstruir; recrear si hace falta.
- [ ] **WhatsApp API**: `config/whatsapp.py` listo. Falta `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` en `.env` de prod.
- [ ] **Turnstile en prod**: poner `TURNSTILE_SECRET` en `.env` de prod para activarlo.
- [x] Carnet PDF: `colegios/carnet.py` (foto + barcode + QR, 4 por hoja). Falta logo del colegio.

## Landing pública (`frontend/src/pages/Landing.jsx`)
Estructura actual (orden de secciones):
1. Nav
2. Hero — con botón "Ver planes" (scroll suave, flecha animada)
3. Greca andina (separador)
4. Prueba social
5. **Planes** — 3 tarjetas (Gratuito / Premium S/49.90 / Enterprise), animación al entrar en viewport
6. Features — 6 tarjetas fondo navy
7. CTA final — fondo blanco, texto navy
8. Footer

**Contacto real**: `cliver20oliver23@gmail.com` · WhatsApp `+51 963 366 849`

## Inconsistencias conocidas / a corregir
- **`tenants/management/commands/crear_tenant_publico.py:21`** — crea `domain='localhost'` hardcodeado. No usar en prod (ya creado a mano).
- Un alumno con asistencias históricas no se puede borrar (FK `PROTECT`). DRF devuelve 500 en vez de 409 — manejar `IntegrityError` en `AlumnoViewSet.destroy()` para respuesta limpia.

## Historial de fixes importantes
- **2026-05-29/30** — Sesión completa de mejoras y seguridad:
  1. **Cierre automático de sesiones** (`asistencia/tasks.py`): tarea `cerrar_sesiones_expiradas` iterando todos los schemas. Beat schedule en `settings.py` cada 5 min.
  2. **Landing**: favicon `PERFIL.png`, planes al inicio (2° sección), 3 tarjetas rediseñadas, secciones innecesarias eliminadas, CTA fondo blanco, emails reales, scroll suave con bounce, animaciones IntersectionObserver.
  3. **Seguridad backend**: `validate_dni` + `validate_nombres/apellido_*` en `AlumnoSerializer`; CORS regex `.pe` → `.com`.
  4. **Alumnos frontend**: `loading="lazy"` en avatares; paginación (100/página, botones Anterior/Siguiente, subtítulo "Mostrando X-Y de Z").
  5. **Arquitectura escáner**: `CONN_MAX_AGE=60`, `actualizar_contadores()` atómico con `queryset.update()`, `transaction.atomic()` + savepoints en `EscaneoService.procesar()`, `CACHES` Redis en prod / LocMemCache en dev.
  6. **Permisos HTTP**: `HorarioEscolarViewSet` → `get_permissions()` (lectura: todos; escritura: solo Director); `SesionDiariaViewSet` → `http_method_names` sin DELETE/PUT; `GestionAlumnos` DELETE → solo Director; `ColegioViewSet` → sin DELETE; webhook `@csrf_exempt`. Verificado con 11/11 tests HTTP.

- **2026-05-21** — Dataset real + mejoras UI:
  1. Importado IES Tupac Amaru: 233 alumnos, 1853 asistencias.
  2. "Colegio no encontrado" JSON para subdominios no registrados.
  3. `Cliente.whatsapp_activo` (Plan Premium) + gate en tasks.
  4. Escáner: input solo acepta 8 dígitos.
  5. `/director/alumnos`: búsqueda por nombre completo y DNI; filtro por sección exacta.

- **2026-05-20** — Setup prod `yachayqr.com`: schema public + superuser `sicoa`; fix dominio `iestacoasa`; SSH deploy key; `TENANT_DOMAIN_SUFFIX`.

- **2026-05-17** — Migración a usuarios por-tenant.
