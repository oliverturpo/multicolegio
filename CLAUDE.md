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
| `xiii.yachayqr.com` | `xiii` | Colegio **"FINESI-8B"** — demo del curso con los 19 compañeros. `whatsapp_activo=True`. Ver sección abajo. |

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
- **`app.json`**: name "YachayQR Apoderados", package Android `com.yachayqr.apoderados`, `version` 1.0.0, `appVersionSource: remote` (EAS auto-incrementa `versionCode`, empezó en 1).
- **`eas.json`**: perfil `preview` → APK instalable (demo directa, sin Play Store); perfil `production` → `.aab` (Play Store).
- **Keystore:** generado y guardado por EAS (`Build Credentials wxLy10N9_Q`, credenciales remotas). **No borrarlo** — firma la app para siempre; si cambia, Play Store rechaza la app como si fuera otra.
- Comando build `.aab`: `cd mobile && ./node_modules/.bin/eas build -p android --profile production`. Ya no es interactivo (proyecto linkeado + keystore existe). El warning `EAS_BUILD_NO_EXPO_GO_WARNING` es inofensivo.
- **EAS compila desde los archivos LOCALES** (no desde git): un build incluye los cambios guardados en `mobile/` aunque no estén commiteados.
- **Regla de actualización:** solo cambios en `mobile/` obligan a nuevo `.aab` + resubir. Cambios en `backend/` o `frontend/` se despliegan al servidor y la app los consume en runtime (sin rebuild). Subir un `.aab` nuevo NO reobliga a llenar la ficha ni los cuestionarios (eso es de una sola vez).

### Estado publicación Play Store — CONFIGURACIÓN COMPLETA ✅ (2026-07-31)
**La app está PUBLICADA en Prueba Interna, instalable y funcionando contra prod.** Toda la configuración de Play Console está terminada. Solo falta (opcional) la Prueba Cerrada de 14 días para abrir Producción.

- **Cuenta Play Console** ($25 pagado): Personal, **Cliver Turpo**, ID `5389279162739461254`, `cliver20oliver23@gmail.com`. **Identidad APROBADA por Google** (ya no está en revisión).
- **App creada:** package `com.yachayqr.apoderados`, idioma default es-419. Mientras Google no revise, los testers la ven como **"com.yachayqr.apoderados (unreviewed)"** (nombre temporal, normal).
- **`.aab` en Prueba Interna:** build `67725f18-1972-464e-8f9f-d7bca1a11ae5`, versionCode 1 / 1.0.0, minSdk 24 (Android 7+). Artifact caduca — re-buildear si se necesita.
- **Prueba Interna ACTIVA** con lista "Testers YachayQR" (1 correo: `cliver20oliver23@gmail.com`). Link instalable vía "Unirse desde la Web". Probado: instala y muestra los colegios. **Este es el entregable del curso.**
- **Ficha completa:** textos (abajo) + ícono + gráfico de funciones + capturas (teléfono 4, tablet 7" 2, tablet 10" 2). Las capturas de tablet sirven para los 3 campos.
- **Recursos gráficos generados** en `F:\SaaS\playstore\` (fuera de git): `icono_512.png` (QR real navy sobre tarjeta blanca + badge dorado con check) y `grafico_funciones_1024x500.png` (marca navy/gold). Generados con PIL + lib `qrcode`.
- **Cuestionarios (todos hechos):**
  - Política de privacidad → `https://yachayqr.com/privacidad.html`
  - **Detalles de acceso** (Google necesita entrar a revisar) → credenciales EN INGLÉS. Apoderado de prueba en **demo de PROD**: DNI **`07821817`** / clave **`yachayqr2026`** (`debe_cambiar_password=False`), tiene 1 hija (Yamile Aguilar Accha). ⚠️ **NO reimportar el dataset demo ni cambiar esa clave hasta que Google termine de revisar**, o el revisor no podrá entrar.
  - Anuncios → No. Gubernamental → No. Financiero → No. Salud → No.
  - Clasificación de contenido → "El resto de tipos de app", todo No → **Para todos / PEGI 3**.
  - Público objetivo → **solo "Mayores de 18 años"** (el usuario es el apoderado adulto, NO el niño; marcar rangos de menores mete la app en "Diseñado para familias" con reglas estrictas). Casilla de restringir menores → sin marcar.
  - **Seguridad de los datos:** recopila **solo "ID de usuario"** (el DNI) — categoría Información personal. Recopilado ✅, Compartido ❌ (va solo a nuestro server, sin terceros), no efímero, obligatorio, propósito = Funciones de la app + Administración de la cuenta. Encriptado en tránsito (HTTPS) ✅. Método de cuenta = usuario+contraseña. La contraseña NO se declara (no hay categoría; es solo autenticación). Los nombres de hijos/asistencias NO se declaran (van del server al device, no se "recopilan").
  - **URL de eliminación de cuenta** (obligatoria por tener login): `https://yachayqr.com/eliminar-cuenta.html` (`frontend/public/eliminar-cuenta.html`, creada 2026-07-31, mismo estilo que privacidad).
  - Categoría → **Educación**. Contacto → correo/WhatsApp/web.

### Prueba Cerrada (camino a Producción) — LANZADA + EN REVISIÓN ✅ (2026-07-31)
Pista **"Prueba cerrada - Alpha"** creada y **enviada a revisión de Google** (14 cambios). Es la pista aparte que abre Producción; la Prueba Interna NO cuenta para su reloj.
- **Versión en la pista:** `2 (1.0.0)` — build EAS `1f3de606-be12-44c2-825b-2052825f1f25`, **versionCode 2**. País: Perú. Estado: **EN REVISIÓN** (Google tarda horas–7 días; usa el apoderado de prueba `07821817`/`yachayqr2026`). Al aprobar, el nombre "(unreviewed)" pasa a "YachayQR Apoderados" (el link de tester YA lo muestra así).
- ⚠️ **Bug resuelto — versionCode repetido:** al subir el `.aab` a la pista cerrada daba *"Ya se usó el código de la versión 1"*. Causa: `eas.json` no tenía `autoIncrement`, así que todo build reusaba versionCode 1. **Fix (commit `004f34b`): `"autoIncrement": true` en el perfil `production`.** Desde ahora cada build sube el versionCode solo. (Builds `67725f18` y `4ed29a92` = versionCode 1; `1f3de606` = versionCode 2, el bueno.)
- **Requisito de los 14 días:** el reloj arranca cuando **12 testers ACEPTAN** el link (aceptar = abrir "Unirse desde la Web" logueado con su Gmail y darle "Convertirme en probador"; NO requiere instalar ni tener celular — se hace desde navegador). Los 14 días son **una sola vez**; las actualizaciones posteriores NO reesperan.
- **Lista de testers "Testers Cerrada YachayQR - nixma" (13 correos, 1 de colchón sobre los 12):**
  `alex20cuevas25@gmail.com`, `cliver20oliver23@gmail.com`, `cliveroliverturpobenique@gmail.com`, `darioaroni864@gmail.com`, `lewisvilca96@gmail.com`, `lilagutierrez390@gmail.com`, `martinabenique@gmail.com`, `nixmayasminaronimamani@gmail.com`, `oliverbenique@gmail.com`, `pepeinambari@gmail.com`, `pumaarmando25@gmail.com`, `selvamaka0@gmail.com`, `susan.vane.juntas@gmail.com`.
- **DÓNDE QUEDAMOS (paso actual):** app **enviada a revisión** + Prueba Cerrada lanzada. `cliver20oliver23@gmail.com` ya aceptó el link ("Eres un probador"). **Falta que los otros 11–12 correos acepten** el link de "Unirse desde la Web" para arrancar los 14 días. Para el curso NO hace falta esperar eso — la Prueba Interna ya es el entregable.

### Textos de la ficha (usados)
- Nombre: **YachayQR Apoderados**
- Descripción corta (≤80): *Consulta la asistencia escolar de tus hijos en tiempo real.*
- Descripción completa: *YachayQR Apoderados te permite consultar de forma rápida y segura el registro de asistencia de tus hijos en su institución educativa. Inicia sesión con tu DNI y revisa si tu hijo llegó puntual, tarde o estuvo ausente, con el historial completo de sus asistencias. Una herramienta simple y directa para mantenerte informado sobre la asistencia escolar de tu familia.*

### PRÓXIMOS PASOS (al retomar)
1. **Perseguir los 12 testers:** que los 13 correos de la lista abran el link de "Unirse desde la Web" de la Prueba Cerrada y acepten. Con 12 aceptados arrancan los 14 días. Revisar en Play Console → Prueba cerrada → cuántos aceptaron.
2. **Esperar la revisión de Google** de la versión `2 (1.0.0)` (Prueba Cerrada). No hay nada que hacer de nuestro lado; solo no romper el apoderado de prueba `07821817`/`yachayqr2026` en demo.
3. Pasados los 14 días con 12 testers + app aprobada → **solicitar acceso a Producción** (tienda pública abierta).
4. NO reimportar el dataset demo ni cambiar la clave de `07821817` hasta que Google termine de revisar.
5. (Pendiente aparte) cablear login de personal (director/auxiliar) en la app; Meta/WhatsApp OTP para "olvidé contraseña" cuando se pague billing.

## Colegio de demo del curso — FINESI-8B (schema `xiii`) · 2026-08-03

Colegio creado para la presentación de ISW2. Los "alumnos" son los **19 compañeros reales** del grupo; cada persona está cargada **dos veces**: como `Alumno` (para escanear) y como su propio `Apoderado` (para recibir el WhatsApp). El mensaje siempre sale al `Apoderado.telefono_whatsapp`, nunca al alumno.

- **DNI = los primeros 8 dígitos de su propio celular** (ej. `963366849` → DNI `96336684`). Mismo DNI para el alumno y el apoderado — son tablas distintas, el `unique` no choca. Se eligió así para que cada uno entre solo a la app móvil sin repartir credenciales: usuario = DNI, clave inicial = el mismo DNI.
- Grado único: `5° "8B" — SECUNDARIA 2026`. Usuario `director` (el resto de roles no se creó).
- Datos cargados con un script al ORM en el servidor (no por la UI: eran ~250 campos a mano). Idempotente por DNI vía `update_or_create` — se puede recorrer otra vez sin duplicar.
- ⚠️ **`HorarioEscolar "Turno Mañana"` (07:30 / 08:00 / 09:00, L-V) está `activo=False` a propósito.** Con `whatsapp_activo=True` en el colegio, activarlo hace que Celery Beat cierre la sesión y dispare WhatsApp **reales a los 19 números**. Encenderlo solo al momento de la demo.
- Secuencia para la demo en vivo: activar horario → abrir sesión en el escáner → escanear a algunos (quedan Presente/Tardanza) → cerrar sesión → a los no escaneados les llega el "no asistió".
- Envíos de prueba verificados el 2026-08-03 a dos números del colegio (`51963366849` y `51910306939`): ambos `delivered`. El que abre el mensaje pasa a `read` — útil para mostrar los estados en vivo.

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

## Integración WhatsApp / Meta — FUNCIONANDO ✅ (2026-08-03)

El código (`config/whatsapp.py`) envía plantillas vía **Meta Cloud API** y **entrega de verdad**. Verificado end-to-end el 2026-08-03: `enviar_template()` desde el shell de Django en prod → webhook confirma `sent` → `delivered` → `read`.

El bloqueo histórico era **solo el pago de la tarjeta**. Al regularizarlo, la WABA pasó de `RESTRICTED` a `ACTIVE` / `account_review_status: APPROVED` y los mensajes empezaron a entregar sin tocar una línea de código.
- `business_verification_status: rejected` **NO impide entregar** — se descartó como causa en la prueba del 2026-08-03. Solo limita escalar volumen.
- El aviso del panel de Meta *"las apps no publicadas no reciben datos de producción"* aplica a otros productos; con la app en **modo Desarrollo** la Cloud API entrega igual desde el número real. No hace falta publicar la app ni ser "proveedor de tecnología" (eso es para el modelo BSP, administrar WABAs de terceros).

**Credenciales (todas en `/var/www/yachayqr/backend/.env`, NO en git):**
- `WHATSAPP_PHONE_ID=1116476101550897` — número business **+51 927 609 290** ("YachayQr", CONNECTED, calidad GREEN, CLOUD_API, TIER_250).
- `WHATSAPP_TOKEN` — token **permanente** de Usuario del sistema "Employee" (no caduca). Permisos: `whatsapp_business_messaging` + `whatsapp_business_management` + `business_management`.
- `WHATSAPP_VERIFY_TOKEN=c32f5d64dcfe2c6faeea52a68e448598` — para el webhook.

**IDs de Meta:** App ID `998741499211127` · Business Portfolio (Business ID) `2212358902828134` · WABA ID (asset_id) `3628620677275857` · System User ID `61589931013622`.

**Plantillas aprobadas en la WABA (es_PE, UTILITY, APPROVED):**
- `yachayqr_ausente` → "{{1}} no asistió a clases hoy {{2}}. Comuníquese con {{3}}."
- `yachayqr_tardanza` → "{{1}} llegó tarde a clases hoy {{2}}. Hora: {{3}}."
- (`hello_world` también, pero solo funciona desde números de PRUEBA, no desde el real.)

**Webhook: SUSCRITO ✅ (2026-08-03).** Endpoint `POST/GET /api/v1/whatsapp/webhook/` (`asistencia/webhook_views.py`) — loggea estados de entrega (`[WA-STATUS]`) vía `logger('whatsapp.webhook')`. Ver en vivo:
```bash
ssh root@137.184.236.181 'timeout 40 journalctl -u yachayqr -f -n 0 | grep -a WA-STATUS'
```
Configuración hecha en dos partes (ambas necesarias):
1. **App Dashboard** → Webhooks → objeto **WhatsApp Business Account** (¡no "User"!) → Callback `https://yachayqr.com/api/v1/whatsapp/webhook/` + `WHATSAPP_VERIFY_TOKEN` → suscribir campo `messages`.
2. **Suscribir la app a la WABA** (esto va por API, no está en la UI):
   `curl -X POST "https://graph.facebook.com/v19.0/3628620677275857/subscribed_apps" -H "Authorization: Bearer $TOKEN"`
   Verificar con el mismo endpoint en GET — si `data` viene vacío, no llega ningún estado.

**Diagnóstico rápido si deja de entregar:**
```bash
# WABA: debe decir status=ACTIVE y account_review_status=APPROVED
curl -s "https://graph.facebook.com/v19.0/3628620677275857?fields=status,account_review_status,business_verification_status" -H "Authorization: Bearer $TOKEN"
# Token: expires_at=0 significa permanente
curl -s "https://graph.facebook.com/v19.0/debug_token?input_token=$TOKEN&access_token=$TOKEN"
```
Si Meta responde `accepted` pero el webhook nunca manda `delivered`, el sospechoso #1 es el **pago** (WABA en `RESTRICTED`). Los endpoints de billing/`extendedcredits` devuelven error 10 con nuestro token — no somos BSP, hay que mirarlo en el Billing Hub de la UI.

**Cómo probar un envío manual:**
```bash
ssh root@137.184.236.181 'cd /var/www/yachayqr/backend
TOKEN=$(grep ^WHATSAPP_TOKEN= .env | cut -d= -f2)
curl -s -X POST "https://graph.facebook.com/v19.0/1116476101550897/messages" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"to\":\"51963366849\",\"type\":\"template\",\"template\":{\"name\":\"yachayqr_tardanza\",\"language\":{\"code\":\"es_PE\"},\"components\":[{\"type\":\"body\",\"parameters\":[{\"type\":\"text\",\"text\":\"Xandy Madizon\"},{\"type\":\"text\",\"text\":\"29/07/2026\"},{\"type\":\"text\",\"text\":\"08:15\"}]}]}}"'
```
Número de prueba del apoderado: **51963366849** (formato Meta = código país sin `+`).

**Prueba end-to-end desde el código real:**
```bash
ssh root@137.184.236.181 'cd /var/www/yachayqr/backend && source venv/bin/activate && python manage.py shell -c "
from config.whatsapp import enviar_template
print(enviar_template(\"963366849\", \"yachayqr_ausente\", [\"Nombre Alumno\", \"03/08/2026\", \"la I.E.\"]))
"'
```

**Pendiente WhatsApp:**
- `whatsapp_activo`: solo **`xiii` (FINESI-8B)** en True. `public`, `demo` y `mgcj` en False — el cierre automático no les envía nada. ⚠️ No activar `demo`: son apoderados **reales** del IESTA Tupac Amaru.
- **OTP "olvidé contraseña"** (app apoderados): falta crear **1 plantilla de categoría AUTENTICACIÓN** en Meta + cablear el flujo (generar código → enviar → verificar). El token actual ya sirve para eso.
- Seguridad: token WhatsApp y Secret de Turnstile son secretos — solo en `.env` del servidor, nunca a git.

## Configuración pendiente (requiere acción manual)
- [x] **Celery Beat en servidor**: `.service` creado y habilitado en el droplet nuevo (2026-07-28).
- [ ] **Fotos de alumnos (demo)**: no estaban en el backup reimportado — recargar si se necesitan.
- [ ] **Colegio `iestacoasa`**: se perdió al reconstruir; recrear si hace falta.
- [x] **WhatsApp API**: token permanente + phone_id en `.env` de prod, plantillas aprobadas, webhook suscrito. **ENTREGANDO ✅ (2026-08-03)** tras regularizar el pago — ver sección "Integración WhatsApp / Meta" abajo.
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
- **2026-07-31** — SSL wildcard, logo por colegio y publicación en Play Store:
  1. **SSL wildcard** (`*.yachayqr.com`): un colegio nuevo (`mgcj`, Martin Chambi) daba "sitio no seguro" porque el cert no era wildcard. Migrado de HTTP-01 a **DNS-01 con `certbot-dns-cloudflare`** (token CF en `/root/.secrets/cloudflare.ini`) + deploy hook para recargar nginx. Ahora cualquier subdominio nace con SSL válido. Ver sección "SSL".
  2. **Logo por colegio** (commit `c181d6f`): campo `Cliente.logo` (ya existía, sin migración) cableado a API + panel del dueño + selector de la app. Endpoints `POST .../colegios/<id>/logo/` y `/quitar-logo/` (POST, no DELETE porque el ViewSet excluye ese verbo). Se descubrió que el urlconf público no servía `/media/` en dev — corregido. Ver sección "Logo del colegio".
  3. **App móvil `EscogerColegio.js`**: pull-to-refresh + botón "Reintentar" para que un colegio recién creado aparezca sin reiniciar la app (antes el `fetch` era 1 sola vez al montar).
  4. **Página `eliminar-cuenta.html`** (commit `026aab3`): requisito de Data Safety de Play Store.
  5. **Publicación Play Store**: identidad aprobada, app creada, `.aab` en Prueba Interna instalable y funcionando, ficha + todos los cuestionarios completos. Ver sección "Estado publicación Play Store".
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
