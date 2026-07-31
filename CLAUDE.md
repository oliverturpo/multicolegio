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
| `mgcj.yachayqr.com` | `mgcj` | Colegio "Martin Chambi" (creado 2026-07-31). |

> `iestacoasa` ya **no existe** en la BD (se perdió al reconstruir el droplet). Los tenants reales en prod son los 3 de arriba.

- DNS (Cloudflare, "Solo DNS"): `yachayqr.com` y `*.yachayqr.com` → `137.184.236.181`.
- SSL: Let's Encrypt **wildcard** `yachayqr.com` + `*.yachayqr.com` (`/etc/letsencrypt/live/yachayqr.com/`). Desde 2026-07-31 **no hay que hacer nada al crear un colegio nuevo** — cualquier subdominio nace con SSL válido.
  - Validación **DNS-01** vía `certbot-dns-cloudflare` (el wildcard no se puede emitir por HTTP-01). Token de API de Cloudflare (permiso `Zone–DNS–Edit`, sin TTL) en `/root/.secrets/cloudflare.ini` (chmod 600, **nunca a git**). Si el token se revoca, las renovaciones fallan y vuelve el "sitio no seguro".
  - Como se usa `certonly` (no `--nginx`), certbot **no recarga nginx solo**: lo hace el deploy hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`. Sin ese hook, tras renovar nginx seguiría sirviendo el cert viejo en memoria.
  - Reemitir a mano: `certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini --dns-cloudflare-propagation-seconds 30 --cert-name yachayqr.com -d yachayqr.com -d '*.yachayqr.com' --expand`
  - Verificar: `certbot renew --dry-run` (probado OK 2026-07-31).
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
TURNSTILE_SECRET=<secret real>                   # configurado 2026-07-29 (widget "YachayQR Login")
WHATSAPP_TOKEN=<token permanente EAA...>         # System User "Employee", no caduca
WHATSAPP_PHONE_ID=1116476101550897               # número +51 927 609 290
WHATSAPP_VERIFY_TOKEN=c32f5d64dcfe2c6faeea52a68e448598
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

### Logo del colegio
El campo `Cliente.logo` (ya existía en el modelo) se sube desde el panel del dueño y se ve en el selector de la app de apoderados. Sin logo se muestra un marcador con las iniciales.
- **Subir/cambiar:** `POST /api/v1/plataforma/colegios/<id>/logo/` (multipart, campo `logo`). PNG/JPG/WEBP, máx. 2 MB — validado en cliente y servidor. Al reemplazar se borra el archivo anterior del disco.
- **Quitar:** `POST /api/v1/plataforma/colegios/<id>/quitar-logo/`. Es POST y no DELETE porque `http_method_names` del `ColegioViewSet` excluye DELETE (para que nadie tire el schema de un colegio por accidente).
- El alta de colegio sigue siendo JSON: el logo se sube en una 2ª llamada. Si esa falla, el colegio **igual queda creado** y el modal avisa para reintentar desde la tabla.
- `colegios-publicos` y `ColegioSerializer` devuelven la URL **absoluta** (`request.build_absolute_uri`) — la app móvil y el panel no comparten origen con el backend.
- Archivos en `backend/media/logos/`; en prod los sirve nginx (`location /media/`), en dev el urlconf público.

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

## App móvil de apoderados + publicación en Play Store

> **Meta del curso ISW2:** publicar la app en Google Play Store. **Deadline: martes 4 ago 2026.**

### App (`mobile/`, Expo SDK 54)
- 5 pantallas: elegir colegio → login (DNI) → cambiar clave (1er ingreso) → mis hijos → asistencias. Navegación por estado (sin react-navigation). Paleta navy/gold. Apunta a **prod** (`yachayqr.com`).
- Backend apoderados ya desplegado y probado en `demo.yachayqr.com`: login por DNI (clave inicial = DNI, cambio obligatorio 1er ingreso), mis-hijos, asistencias. Endpoint público `colegios-publicos`. DNI de prueba: `06345456`.
- Correr en Expo Go: `cd mobile && npx expo start`.

### Build EAS (genera el archivo para Play Store)
- **Cuenta Expo (gratis):** `cliverturopo` (Personal). Proyecto EAS: `@cliverturopo/yachayqr-apoderados`, projectId `6b0a6909-8d32-427a-a163-58405dfdd887`.
- `eas-cli` instalado como devDependency en `mobile/`. Login: `./node_modules/.bin/eas login` (interactivo, vía navegador).
- **`app.json`**: name "YachayQR Apoderados", package Android `com.yachayqr.apoderados`, versión remota (EAS maneja `versionCode`).
- **`eas.json`**: perfil `preview` → APK instalable (demo directa, sin Play Store); perfil `production` → `.aab` (Play Store).
- **Keystore:** generado y guardado por EAS (credenciales remotas). No borrarlo — firma la app para siempre.
- Comando build `.aab`: `cd mobile && ./node_modules/.bin/eas build -p android --profile production`. Primer build fue interactivo (crear proyecto + keystore = "Yes"). **`.aab` ya generado con éxito** (link de artifact en el dashboard de Expo; caduca, re-buildear si se necesita).
- Cada cambio futuro = nuevo build → resubir. En **Testing Interno** las actualizaciones son inmediatas (no re-testea 14 días).

### Política de privacidad (obligatoria para la ficha)
- Archivo: `frontend/public/privacidad.html` → servido en **https://yachayqr.com/privacidad.html** (ya vivo). Esa URL va en la ficha de Play Store.

### Cuenta Google Play Console ($25, pago único) — EN VERIFICACIÓN
- Cuenta **Personal** a nombre de **Cliver Turpo**, ID `5389279162739461254`, correo `cliver20oliver23@gmail.com`. **Pagada.**
- Estado de verificaciones (al 29 jul 2026):
  - ✅ **Identidad (DNI)** → enviada, **EN REVISIÓN de Google** (tarda algunos días). Nota: se ingresó una dirección distinta a la del DNI; Google verifica sobre todo autenticidad del documento + nombre, así que probablemente pase. Si rechazan por eso, reenviar con la dirección del DNI.
  - ✅ **Dispositivo Android** (app Play Console en el celular).
  - ⏳ **Teléfono** → se desbloquea solo cuando aprueben la identidad. La dirección/teléfono se editan en **Configuración → Detalles de la cuenta**.
- **Realidad Play Store:** cuentas personales nuevas requieren **test cerrado de 14 días** (12 testers) antes de habilitar *Producción* (tienda abierta). Camino para el deadline: **Testing Interno** → link de Play Store instalable de inmediato. Producción full ~2 semanas después (regla de Google, no nuestra).

### Textos de la ficha (listos)
- Nombre: **YachayQR Apoderados**
- Descripción corta (≤80): *Consulta la asistencia escolar de tus hijos en tiempo real.*
- Descripción completa: *YachayQR Apoderados te permite consultar de forma rápida y segura el registro de asistencia de tus hijos en su institución educativa. Inicia sesión con tu DNI y revisa si tu hijo llegó puntual, tarde o estuvo ausente, con el historial completo de sus asistencias. Una herramienta simple y directa para mantenerte informado sobre la asistencia escolar de tu familia.*

### PRÓXIMOS PASOS (al retomar)
1. **Esperar aprobación de identidad de Google** (nada que hacer de nuestro lado hasta eso).
2. Mientras tanto: **tomar capturas de pantalla** de la app en Expo Go (mín. 2, de celular) para la ficha — pantallas: elegir colegio, login, mis hijos, asistencias.
3. Aprobada la cuenta: **crear la app** en Play Console → llenar ficha (textos arriba + URL de privacidad) → **subir el `.aab` a Testing Interno** → obtener link instalable.
4. (Paralelo) arrancar el test cerrado de 14 días para Producción.
5. (Pendiente aparte) cablear login de personal (director/auxiliar) en la app; Meta/WhatsApp OTP para "olvidé contraseña" cuando se pague billing.

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

## Cloudflare Turnstile (login) — CONFIGURADO ✅ (2026-07-29)

El widget de Turnstile protege los logins (`frontend/src/pages/Login.jsx` y `pages/plataforma/Login.jsx`). Antes usaba la key de PRUEBA de Cloudflare (`1x00000000000000000000AA`, fallback en el código) y el login se veía roto. Ahora usa llaves reales:
- **Widget en Cloudflare:** "YachayQR Login". **Site Key (pública):** `0x4AAAAAADTOqmECePp1BI59`. Secret Key vive solo en el `.env` del servidor.
- **Frontend:** `frontend/.env.production` **en el servidor** (gitignored) con `VITE_TURNSTILE_SITE_KEY=<site key>`. Se hornea en el build (`npm run build`). ⚠️ NO poner `VITE_API_URL` ahí — la URL del API se deriva del host en runtime (si no, se rompe el multi-tenant).
- **Backend:** `TURNSTILE_SECRET=<secret>` en `/var/www/yachayqr/backend/.env`. `config/turnstile.py` valida contra Cloudflare (falla cerrado). Si el secret está vacío (dev) se omite.
- ⚠️ **Hostnames del widget:** en Cloudflare el widget debe incluir `yachayqr.com` (cubre subdominios `demo.`, `iestacoasa.`). Confirmar si se agrega un colegio nuevo.

## Integración WhatsApp / Meta — LISTA pero BLOQUEADA POR PAGO ⚠️ (2026-07-29)

El código (`config/whatsapp.py`) envía plantillas vía **Meta Cloud API**. Todo está cableado y probado; **lo único que falla es el pago de la tarjeta** (ver abajo). El código es correcto — el día que una tarjeta pase el cargo, entrega solo.

**Credenciales (todas en `/var/www/yachayqr/backend/.env`, NO en git):**
- `WHATSAPP_PHONE_ID=1116476101550897` — número business **+51 927 609 290** ("YachayQr", CONNECTED, calidad GREEN, CLOUD_API, TIER_250).
- `WHATSAPP_TOKEN` — token **permanente** de Usuario del sistema "Employee" (no caduca). Permisos: `whatsapp_business_messaging` + `whatsapp_business_management` + `business_management`.
- `WHATSAPP_VERIFY_TOKEN=c32f5d64dcfe2c6faeea52a68e448598` — para el webhook.

**IDs de Meta:** App ID `998741499211127` · Business Portfolio (Business ID) `2212358902828134` · WABA ID (asset_id) `3628620677275857` · System User ID `61589931013622`.

**Plantillas aprobadas en la WABA (es_PE, UTILITY, APPROVED):**
- `yachayqr_ausente` → "{{1}} no asistió a clases hoy {{2}}. Comuníquese con {{3}}."
- `yachayqr_tardanza` → "{{1}} llegó tarde a clases hoy {{2}}. Hora: {{3}}."
- (`hello_world` también, pero solo funciona desde números de PRUEBA, no desde el real.)

**Webhook:** endpoint `POST/GET /api/v1/whatsapp/webhook/` (`asistencia/webhook_views.py`) — loggea estados de entrega (`[WA-STATUS]`) vía `logger('whatsapp.webhook')`, leíbles con `journalctl -u yachayqr`. El handshake GET valida con `WHATSAPP_VERIFY_TOKEN`. **Falta suscribirlo en Meta** (WhatsApp → Configuración → Webhook → Callback `https://yachayqr.com/api/v1/whatsapp/webhook/` + token, suscribir campo `messages`) — opcional, solo para ver estados en vivo.

**⛔ EL BLOQUEO (por qué no entrega):**
- La cuenta está **RESTRINGIDA**: Meta no pudo hacer la **retención temporal** (authorization hold) en la tarjeta → sin fondos suficientes / tarjeta rechazada. Mensaje de Meta: *"Cuenta de WhatsApp Business restringida — No hemos podido procesar tu pago."*
- Al enviar, Meta responde `messages[0].message_status: accepted` pero **NO entrega** (queda encolado) mientras la cuenta esté restringida.
- Tarjetas registradas: Visa ···9991 (default, falló el hold), Visa ···3134. Interbank da "La tarjeta no se puede utilizar" → falta activar **compras internacionales/recurrentes** en la app del banco, o usar tarjeta de crédito.
- Saldo real: solo **0,41 S/** (céntimos). El problema NO es el monto, es que la tarjeta no pasa el hold de verificación.
- `business_verification_status: rejected` (afecta escalar a producción; no bloquea el primer envío — el bloqueo es el pago).

**Cómo probar un envío manual (cuando el pago esté al día):**
```bash
ssh root@137.184.236.181 'cd /var/www/yachayqr/backend
TOKEN=$(grep ^WHATSAPP_TOKEN= .env | cut -d= -f2)
curl -s -X POST "https://graph.facebook.com/v19.0/1116476101550897/messages" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"to\":\"51963366849\",\"type\":\"template\",\"template\":{\"name\":\"yachayqr_tardanza\",\"language\":{\"code\":\"es_PE\"},\"components\":[{\"type\":\"body\",\"parameters\":[{\"type\":\"text\",\"text\":\"Xandy Madizon\"},{\"type\":\"text\",\"text\":\"29/07/2026\"},{\"type\":\"text\",\"text\":\"08:15\"}]}]}}"'
```
Número de prueba del apoderado: **51963366849** (formato Meta = código país sin `+`).

**Pendiente WhatsApp (cuando haya pago):**
- **OTP "olvidé contraseña"** (app apoderados): falta crear **1 plantilla de categoría AUTENTICACIÓN** en Meta + cablear el flujo (generar código → enviar → verificar). El token actual ya sirve para eso.
- Seguridad: token WhatsApp y Secret de Turnstile son secretos — solo en `.env` del servidor, nunca a git.

## Configuración pendiente (requiere acción manual)
- [x] **Celery Beat en servidor**: `.service` creado y habilitado en el droplet nuevo (2026-07-28).
- [ ] **Fotos de alumnos (demo)**: no estaban en el backup reimportado — recargar si se necesitan.
- [ ] **Colegio `iestacoasa`**: se perdió al reconstruir; recrear si hace falta.
- [x] **WhatsApp API**: token permanente + phone_id ya en `.env` de prod (2026-07-29). Plantillas aprobadas. **BLOQUEADO por pago** — ver sección "Integración WhatsApp / Meta" abajo.
- [x] **Turnstile en prod**: Site Key + Secret Key reales configurados y desplegados (2026-07-29). Ver sección "Cloudflare Turnstile" abajo.
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
