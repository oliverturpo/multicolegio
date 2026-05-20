"""
Migracion del backup de IES Tupac Amaru al schema `demo` de YachayQR.

Origen:
  - SQLite:  F:/SaaS/backup_asistencia_2026-05-20/db_2026-05-20.sqlite3
  - Fotos:   F:/SaaS/backup_asistencia_2026-05-20/fotos_optimizadas/  (ya optimizadas)

Destino:
  - Postgres del proyecto, schema `demo` via django-tenants.

Comportamiento:
  - Conserva los 4 usuarios del schema demo (director / auxiliar / psicologo / escaner).
  - Borra todos los datos de modelos de colegios/asistencia y los reemplaza
    con los del backup.
  - 233 apoderados ficticios generados con la formula Opcion A acordada.
  - 231 fotos optimizadas copiadas a backend/media/alumnos/fotos/.
  - Todo dentro de una transaccion: si algo falla, rollback completo.

Uso:
  cd F:/SaaS/backend
  venv\\Scripts\\activate
  python migrar_tupac.py

Para correrlo en el servidor: copiar este archivo + el sqlite + la carpeta
fotos_optimizadas al servidor, ajustar SQLITE y FOTOS_ORIGEN abajo, correr.
"""
import os
import random
import shutil
import sqlite3
import sys
from collections import defaultdict
from datetime import date, datetime, time
from pathlib import Path

# ─── Configuracion ─────────────────────────────────────────────────────
# Este script vive en la raiz del proyecto (junto a backend/, frontend/).
PROJECT_ROOT   = Path(__file__).resolve().parent
SQLITE         = PROJECT_ROOT / 'db_2026-05-20.sqlite3'
# Carpeta de fotos opcional: si no existe, asume que las fotos ya estan en
# backend/media/alumnos/fotos/ del destino (caso servidor) y solo asocia el
# nombre del archivo al alumno sin copiar.
FOTOS_ORIGEN   = PROJECT_ROOT / 'fotos_optimizadas'
TENANT_SCHEMA  = 'demo'
AÑO_ACADEMICO  = 2026
FECHA_NAC_FAKE = date(2010, 1, 1)
SEED           = 42   # nombres/apellidos aleatorios reproducibles

random.seed(SEED)

# ─── Bootstrap Django ──────────────────────────────────────────────────
# Django vive en backend/ — agregamos esa ruta al sys.path para que
# `config.settings` (que esta en backend/config/) sea importable.
sys.path.insert(0, str(PROJECT_ROOT / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.conf import settings
from django.db import transaction
from django_tenants.utils import schema_context

from tenants.models import Cliente
from colegios.models import Apoderado, GradoSeccion, Alumno
from asistencia.models import (
    HorarioEscolar, SesionDiaria, Asistencia,
    Justificacion, ContadorJustificacion, IngresoManual, Notificacion,
)
from usuarios.models import UsuarioSistema

# ─── Mapeos ────────────────────────────────────────────────────────────
GRADO_TXT_A_INT = {'1ro': 1, '2do': 2, '3ro': 3, '4to': 4, '5to': 5}
ESTADO_MAP = {
    'present': Asistencia.Estado.PRESENTE,
    'late':    Asistencia.Estado.TARDANZA,
    'absent':  Asistencia.Estado.AUSENTE,
}
METODO_MAP = {
    'manual':    Asistencia.MetodoRegistro.MANUAL,
    'barcode':   Asistencia.MetodoRegistro.ESCANER,
    'scanner':   Asistencia.MetodoRegistro.ESCANER,
    'automatic': Asistencia.MetodoRegistro.AUTOMATICO,
}
SESION_ESTADO_MAP = {
    'open':   SesionDiaria.Estado.ABIERTA,
    'closed': SesionDiaria.Estado.CERRADA,
}
PARENTESCO_CICLO = [
    Apoderado.Parentesco.PADRE,
    Apoderado.Parentesco.MADRE,
    Apoderado.Parentesco.TUTOR,
    Apoderado.Parentesco.APODERADO,
]


def t(v):
    """Convierte 'HH:MM[:SS]' (o datetime) a datetime.time, o None."""
    if v is None or v == '':
        return None
    if isinstance(v, time):
        return v
    s = str(v)
    if 'T' in s or ' ' in s:
        s = s.split('T')[-1].split(' ')[-1]
    s = s.split('.')[0]
    partes = s.split(':')
    h = int(partes[0])
    m = int(partes[1]) if len(partes) > 1 else 0
    sec = int(partes[2]) if len(partes) > 2 else 0
    return time(h, m, sec)


def d(v):
    """Convierte 'YYYY-MM-DD' a datetime.date."""
    if isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


def main():
    # ─── Validaciones pre-migracion ────────────────────────────────────
    if not SQLITE.exists():
        sys.exit(f'No existe sqlite: {SQLITE}')
    if not Cliente.objects.filter(schema_name=TENANT_SCHEMA).exists():
        sys.exit(f'No existe tenant `{TENANT_SCHEMA}`')
    copiar_fotos = FOTOS_ORIGEN.exists()
    if not copiar_fotos:
        print(f'⚠ No existe {FOTOS_ORIGEN} — se omite copia de fotos '
              f'(se asume que ya estan en media/alumnos/fotos/)')

    con = sqlite3.connect(str(SQLITE))
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # ─── Cargar TODO desde sqlite a memoria ────────────────────────────
    estudiantes = list(cur.execute(
        "SELECT id, dni, first_name, paternal_surname, maternal_surname, "
        "grade, section, photo, is_active, sex "
        "FROM students_student ORDER BY id"
    ))
    sesiones_src = list(cur.execute(
        "SELECT id, date, scheduled_open_time, punctuality_limit, "
        "scheduled_close_time, actual_open_time, actual_close_time, "
        "status, total_students "
        "FROM attendance_dailysession ORDER BY date"
    ))
    asistencias_src = list(cur.execute(
        "SELECT id, scan_timestamp, status, laptop_id, registration_method, "
        "student_id, session_id "
        "FROM attendance_attendance ORDER BY id"
    ))
    config_src = dict((r['config_key'], r['config_value']) for r in cur.execute(
        "SELECT config_key, config_value FROM attendance_systemconfig"
    ))
    con.close()

    print(f'Leidos del backup: {len(estudiantes)} alumnos, '
          f'{len(sesiones_src)} sesiones, {len(asistencias_src)} asistencias')

    # ─── Construir pools de nombres/apellidos desde los alumnos ────────
    nombres_M, nombres_F, apellidos = [], [], []
    for e in estudiantes:
        # Alumno con sex=NULL (id=189 Flor Taisa) se asume F
        sex = e['sex'] or 'F'
        if sex == 'M':
            nombres_M.append(e['first_name'])
        else:
            nombres_F.append(e['first_name'])
        apellidos.append(e['paternal_surname'])
        apellidos.append(e['maternal_surname'])

    # ─── Pre-calcular prefijos de DNI para resolver colisiones (Opcion A) ─
    grupos_prefijo = defaultdict(list)
    for e in estudiantes:
        grupos_prefijo[e['dni'][:-1]].append(e['id'])

    digito_prefijo = {}  # id_alumno_src -> digito (0..9)
    for prefijo, ids in grupos_prefijo.items():
        for i, sid in enumerate(ids):
            if i > 9:
                sys.exit(f'Mas de 10 colisiones en prefijo {prefijo} — formula insuficiente')
            digito_prefijo[sid] = i

    # ─── Migracion dentro de transaccion + schema demo ────────────────
    with schema_context(TENANT_SCHEMA), transaction.atomic():
        # 1) WIPE — orden respeta FK (child antes que parent)
        print('\n[1/9] Limpiando schema demo...')
        Notificacion.objects.all().delete()
        IngresoManual.objects.all().delete()
        Justificacion.objects.all().delete()
        ContadorJustificacion.objects.all().delete()
        Asistencia.objects.all().delete()
        SesionDiaria.objects.all().delete()
        HorarioEscolar.objects.all().delete()
        Alumno.objects.all().delete()
        Apoderado.objects.all().delete()
        GradoSeccion.objects.all().delete()
        print('   OK — usuarios conservados:',
              list(UsuarioSistema.objects.values_list('user__username', flat=True)))

        # 2) GradoSeccion (12)
        print('[2/9] Creando grados/secciones...')
        secciones_unicas = {(e['grade'], e['section']) for e in estudiantes}
        gs_por_clave = {}
        for grado_txt, seccion in sorted(secciones_unicas):
            gs = GradoSeccion.objects.create(
                nivel=GradoSeccion.Nivel.SECUNDARIA,
                grado=GRADO_TXT_A_INT[grado_txt],
                nombre_seccion=seccion,
                año_academico=AÑO_ACADEMICO,
            )
            gs_por_clave[(grado_txt, seccion)] = gs
        print(f'   OK — {len(gs_por_clave)} secciones')

        # 3) Apoderados (233) — uno por alumno
        print('[3/9] Creando apoderados ficticios...')
        apo_por_alumno_src = {}   # id_alumno_src -> instancia Apoderado
        for i, e in enumerate(estudiantes):
            parentesco = PARENTESCO_CICLO[i % 4]
            if parentesco == Apoderado.Parentesco.PADRE:
                sexo, pool = Apoderado.Sexo.MASCULINO, nombres_M
            elif parentesco == Apoderado.Parentesco.MADRE:
                sexo, pool = Apoderado.Sexo.FEMENINO, nombres_F
            else:
                if random.random() < 0.5:
                    sexo, pool = Apoderado.Sexo.MASCULINO, nombres_M
                else:
                    sexo, pool = Apoderado.Sexo.FEMENINO, nombres_F

            dni_apo = f"{digito_prefijo[e['id']]}{e['dni'][:-1]}"
            apo = Apoderado.objects.create(
                dni=dni_apo,
                nombres=random.choice(pool),
                apellido_paterno=random.choice(apellidos),
                apellido_materno=random.choice(apellidos),
                sexo=sexo,
                telefono_whatsapp=f"9{e['dni']}",
                parentesco=parentesco,
            )
            apo_por_alumno_src[e['id']] = apo
        print(f'   OK — {len(apo_por_alumno_src)} apoderados')

        # 4) Alumnos (233)
        print('[4/9] Creando alumnos y copiando fotos...')
        media_alumnos = Path(settings.MEDIA_ROOT) / 'alumnos' / 'fotos'
        media_alumnos.mkdir(parents=True, exist_ok=True)

        alumno_por_src = {}  # id_alumno_src -> instancia Alumno
        fotos_copiadas = 0
        fotos_faltantes = []
        for e in estudiantes:
            sex = e['sex'] or 'F'
            sexo = Alumno.Sexo.MASCULINO if sex == 'M' else Alumno.Sexo.FEMENINO

            # Foto: la BD origen apunta a .png/.jpeg, las optimizadas son .jpg
            foto_rel = None
            if e['photo']:
                nombre_archivo = Path(e['photo']).stem + '.jpg'  # cambia extension
                if copiar_fotos:
                    origen_jpg = FOTOS_ORIGEN / nombre_archivo
                    if origen_jpg.exists():
                        destino_jpg = media_alumnos / nombre_archivo
                        shutil.copy2(origen_jpg, destino_jpg)
                        foto_rel = f'alumnos/fotos/{nombre_archivo}'
                        fotos_copiadas += 1
                    else:
                        fotos_faltantes.append((e['dni'], e['photo']))
                else:
                    # No copia: asume que la foto ya esta en media/alumnos/fotos/
                    destino_jpg = media_alumnos / nombre_archivo
                    if destino_jpg.exists():
                        foto_rel = f'alumnos/fotos/{nombre_archivo}'
                    else:
                        fotos_faltantes.append((e['dni'], e['photo']))

            alumno = Alumno(
                dni=e['dni'],
                nombres=e['first_name'],
                apellido_paterno=e['paternal_surname'],
                apellido_materno=e['maternal_surname'],
                sexo=sexo,
                fecha_nacimiento=FECHA_NAC_FAKE,
                estado=Alumno.Estado.ACTIVO if e['is_active'] else Alumno.Estado.RETIRADO,
                grado_seccion=gs_por_clave[(e['grade'], e['section'])],
                apoderado=apo_por_alumno_src[e['id']],
            )
            if foto_rel:
                alumno.foto.name = foto_rel
            alumno.save()  # save() rellena codigo_barras = dni
            alumno_por_src[e['id']] = alumno

        print(f'   OK — {len(alumno_por_src)} alumnos, {fotos_copiadas} fotos copiadas')
        if fotos_faltantes:
            print(f'   ⚠ {len(fotos_faltantes)} fotos faltantes (foto=NULL en BD):')
            for dni, p in fotos_faltantes:
                print(f'      DNI {dni}: {p}')

        # 5) HorarioEscolar (1)
        print('[5/9] Creando horario escolar...')
        horario = HorarioEscolar.objects.create(
            nombre=config_src.get('institution_name', 'IES Tupac Amaru'),
            hora_entrada=t(config_src.get('open_time', '07:00')),
            hora_limite_puntual=t(config_src.get('punctuality_limit', '08:00')),
            hora_cierre=t(config_src.get('close_time', '21:00')),
            dias_laborables=[0, 1, 2, 3, 4],
            activo=True,
        )
        print(f'   OK — {horario}')

        # 6) SesionDiaria (9)
        print('[6/9] Creando sesiones diarias...')
        sesion_por_src = {}  # id_src -> instancia
        for s in sesiones_src:
            sesion = SesionDiaria.objects.create(
                horario=horario,
                fecha=d(s['date']),
                estado=SESION_ESTADO_MAP.get(s['status'], SesionDiaria.Estado.CERRADA),
                hora_apertura_real=t(s['actual_open_time']),
                hora_cierre_real=t(s['actual_close_time']),
                total_alumnos=s['total_students'] or 0,
                abierta_por=None,
                cerrada_por=None,
                whatsapp_enviados=False,
            )
            sesion_por_src[s['id']] = sesion
        print(f'   OK — {len(sesion_por_src)} sesiones')

        # 7) Asistencias (1853) — bulk_create por velocidad
        print('[7/9] Creando asistencias...')
        objetos = []
        descartadas = 0
        for a in asistencias_src:
            sesion = sesion_por_src.get(a['session_id'])
            alumno = alumno_por_src.get(a['student_id'])
            if not sesion or not alumno:
                descartadas += 1
                continue
            ts = a['scan_timestamp']
            hora_reg = t(ts) if ts else None
            objetos.append(Asistencia(
                sesion=sesion,
                alumno=alumno,
                fecha=sesion.fecha,
                hora_registro=hora_reg,
                estado=ESTADO_MAP.get(a['status'], Asistencia.Estado.AUSENTE),
                metodo=METODO_MAP.get(
                    (a['registration_method'] or '').lower(),
                    Asistencia.MetodoRegistro.MANUAL,
                ),
                registrado_por=None,
                whatsapp_enviado=False,
            ))
        Asistencia.objects.bulk_create(objetos, batch_size=500)
        print(f'   OK — {len(objetos)} asistencias creadas, {descartadas} descartadas')

        # 8) Recalcular contadores de sesion
        print('[8/9] Recalculando contadores de sesion...')
        for s in SesionDiaria.objects.all():
            s.actualizar_contadores()

        # 9) Verificacion final
        print('[9/9] Verificacion final:')
        print(f'   GradoSeccion:    {GradoSeccion.objects.count()}')
        print(f'   Apoderado:       {Apoderado.objects.count()}')
        print(f'   Alumno:          {Alumno.objects.count()}')
        print(f'   con foto:        {Alumno.objects.exclude(foto="").count()}')
        print(f'   HorarioEscolar:  {HorarioEscolar.objects.count()}')
        print(f'   SesionDiaria:    {SesionDiaria.objects.count()}')
        print(f'   Asistencia:      {Asistencia.objects.count()}')
        print(f'   UsuarioSistema:  {UsuarioSistema.objects.count()} (conservados)')

    print('\n✓ Migracion completada exitosamente.')


if __name__ == '__main__':
    main()
