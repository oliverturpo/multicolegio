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

## Modelos clave
```
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
Todas las páginas son placeholders. Construir en este orden:

1. **Escáner** (`/auxiliar/escaner`) — pantalla de uso diario, máxima prioridad
2. **Dashboard Director** (`/director/dashboard`) — stats de sesión del día
3. **Alumnos** — CRUD + generación de carnet PDF con código de barras
4. **Justificaciones** — flujo psicólogo
5. **Reportes** — exportar Excel/PDF
6. **Usuarios** — CRUD usuarios del sistema

## Horario escolar (demo)
| Campo | Valor | Significado |
|-------|-------|-------------|
| hora_entrada | 07:30 | Se abre la sesión, alumnos empiezan a entrar |
| hora_limite_puntual | 08:00 | Después de esta hora = TARDANZA |
| hora_cierre | 09:00 | Se cierra, los sin registro = AUSENTE automático |
| dias_laborables | [0,1,2,3,4] | Lunes a viernes |

El horario es modificable por el Director desde `/director/dashboard` (próximamente).

## Lógica de negocio importante
- WhatsApp se envía al **cierre de sesión** (Celery task), no al escanear
- Solo el **Auxiliar** puede cambiar Tardanza → Justificado (no el Director)
- Límite de **3 justificaciones** por alumno; al llegar notifica al Director
- Anti-fraude: detectar entrada manual de DNI vs escáner (modelo `IngresoManual`)
- El código de barras / QR **es el DNI** del alumno (sin prefijo; el requisito "YQ"+DNI fue eliminado)
- Sección puede ser texto libre: "A", "B", "Albert Einstein"

## Configuración pendiente (requiere acción manual)
- [x] Cloudflare Turnstile: validado en backend (`config/turnstile.py`). Falta poner `TURNSTILE_SECRET` en `.env` para activarlo en prod (en dev se omite).
- [x] Carnet PDF: implementado en `colegios/carnet.py` (foto + barcode Code128 + QR, 4 por hoja). Falta solo el logo del colegio.
- [ ] WhatsApp API: la tarea `asistencia/tasks.py` ya es tenant-aware; falta el envío real (Twilio / Meta Cloud API) donde está el `print(...)`. Requiere worker Celery corriendo.
