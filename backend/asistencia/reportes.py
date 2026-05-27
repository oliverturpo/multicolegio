"""
Generación de reportes de asistencia (Excel / PDF).

Tenant-aware: corre dentro del schema del colegio (lo fija el
TenantMainMiddleware por el subdominio del request). El nombre de la
institución se toma de `connection.tenant`.

Excel: se entrega como CSV UTF-8 con BOM. Excel lo abre nativamente con
tildes correctas y sin dependencias extra (no requiere openpyxl).
PDF: reportlab (ya instalado, usado también en colegios/carnet.py).
"""
import csv
import io

from django.db import connection
from django.utils.timezone import localtime, now
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from colegios.models import GradoSeccion
from .models import Asistencia, SesionDiaria

# Paleta del proyecto (coincide con el frontend)
NAVY = colors.HexColor('#0f2a4c')
NAVY_MID = colors.HexColor('#1e3a5f')
GOLD = colors.HexColor('#fbbf24')
LIGHT = colors.HexColor('#f8fafc')
BORDER = colors.HexColor('#e2e8f0')
INK = colors.HexColor('#1e293b')

ESTADO_LABEL = {
    'PRESENTE': 'Presente',
    'TARDANZA': 'Tardanza',
    'AUSENTE': 'Ausente',
    'JUSTIFICADO': 'Justificado',
}
METODO_LABEL = {
    'ESCANER': 'Escáner',
    'MANUAL': 'Manual',
    'AUTOMATICO': 'Automático',
}


def _institucion() -> str:
    t = getattr(connection, 'tenant', None)
    return (getattr(t, 'nombre', '') or 'Institución Educativa').strip()


def _queryset(fecha, grado_id=None, estado=None):
    qs = (
        Asistencia.objects
        .select_related('alumno', 'alumno__grado_seccion', 'alumno__apoderado')
        .filter(fecha=fecha)
    )
    if grado_id:
        qs = qs.filter(alumno__grado_seccion_id=grado_id)
    if estado:
        qs = qs.filter(estado=estado)
    return qs.order_by(
        'alumno__grado_seccion__grado',
        'alumno__grado_seccion__nombre_seccion',
        'alumno__apellido_paterno',
        'alumno__apellido_materno',
        'alumno__nombres',
    )


def _resumen(fecha, registros):
    """Stats: usa los contadores de la SesionDiaria si existe; si no,
    los calcula de los registros filtrados."""
    sesion = SesionDiaria.objects.filter(fecha=fecha).first()
    conteo = {'PRESENTE': 0, 'TARDANZA': 0, 'AUSENTE': 0, 'JUSTIFICADO': 0}
    for r in registros:
        if r.estado in conteo:
            conteo[r.estado] += 1
    total = len(registros)
    presentes = conteo['PRESENTE']
    return {
        'sesion': sesion,
        'total': total,
        'presentes': presentes,
        'tardanzas': conteo['TARDANZA'],
        'ausentes': conteo['AUSENTE'],
        'justificados': conteo['JUSTIFICADO'],
        'porcentaje': round(presentes / total * 100, 1) if total else 0.0,
    }


def _grado_label(gs):
    if not gs:
        return '—'
    return f'{gs.grado}° "{gs.nombre_seccion}"'


def _pie_pagina(canvas, doc):
    """Pie de página: fecha de generación a la izquierda, número de página a la derecha."""
    canvas.saveState()
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(colors.HexColor('#64748b'))
    w, _ = doc.pagesize
    generado = f'Generado: {localtime(now()).strftime("%d/%m/%Y %H:%M")}'
    pagina   = f'Página {canvas.getPageNumber()}'
    canvas.drawString(doc.leftMargin, 0.75 * cm, generado)
    canvas.drawRightString(w - doc.rightMargin, 0.75 * cm, pagina)
    canvas.restoreState()


# ── Excel (CSV UTF-8 BOM) ─────────────────────────────────────────

def generar_excel(fecha, grado_id=None, estado=None) -> bytes:
    registros = list(_queryset(fecha, grado_id, estado))
    res = _resumen(fecha, registros)

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=';')

    w.writerow([_institucion()])
    w.writerow(['Reporte de asistencia', fecha.strftime('%d/%m/%Y')])
    w.writerow([])
    w.writerow([
        'Total', 'Presentes', 'Tardanzas', 'Ausentes', 'Justificados', '% Asistencia',
    ])
    w.writerow([
        res['total'], res['presentes'], res['tardanzas'],
        res['ausentes'], res['justificados'], f"{res['porcentaje']}%",
    ])
    w.writerow([])
    w.writerow(['N°', 'DNI', 'Alumno', 'Grado / Sección', 'Estado', 'Hora', 'Método', 'Apoderado', 'Teléfono'])
    for i, r in enumerate(registros, 1):
        a = r.alumno
        apo = getattr(a, 'apoderado', None)
        w.writerow([
            i,
            a.dni,
            f'{a.apellido_paterno} {a.apellido_materno}, {a.nombres}',
            _grado_label(a.grado_seccion),
            ESTADO_LABEL.get(r.estado, r.estado),
            r.hora_registro.strftime('%H:%M') if r.hora_registro else '—',
            METODO_LABEL.get(r.metodo, r.metodo),
            apo.nombre_completo if apo else '—',
            apo.telefono_whatsapp if apo else '—',
        ])

    # BOM para que Excel detecte UTF-8 (tildes/ñ correctas)
    return '﻿'.encode('utf-8') + buf.getvalue().encode('utf-8')


# ── PDF (reportlab) ───────────────────────────────────────────────

def generar_pdf(fecha, grado_id=None, estado=None) -> bytes:
    registros = list(_queryset(fecha, grado_id, estado))
    res = _resumen(fecha, registros)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=1.6 * cm, rightMargin=1.6 * cm,
        topMargin=1.4 * cm, bottomMargin=1.4 * cm,
        title=f'Reporte de asistencia {fecha.isoformat()}',
    )

    base = getSampleStyleSheet()
    st_inst = ParagraphStyle(
        'inst', parent=base['Title'], fontSize=16, textColor=NAVY,
        spaceAfter=2, alignment=TA_CENTER, fontName='Helvetica-Bold',
    )
    st_sub = ParagraphStyle(
        'sub', parent=base['Normal'], fontSize=10.5, textColor=INK,
        alignment=TA_CENTER, spaceAfter=2,
    )
    st_meta = ParagraphStyle(
        'meta', parent=base['Normal'], fontSize=9, textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER, spaceAfter=14,
    )

    el = []
    el.append(Paragraph(_institucion().upper(), st_inst))
    el.append(Paragraph('Reporte de Asistencia', st_sub))

    filtros = [f"Fecha: {fecha.strftime('%d/%m/%Y')}"]
    if grado_id:
        gs = GradoSeccion.objects.filter(id=grado_id).first()
        if gs:
            filtros.append(f'Sección: {gs.grado}° {gs.nombre_seccion}')
    if estado:
        filtros.append(f'Estado: {ESTADO_LABEL.get(estado, estado)}')
    el.append(Paragraph(' · '.join(filtros), st_meta))

    # Tarjeta de resumen
    resumen_data = [[
        'TOTAL', 'PRESENTES', 'TARDANZAS', 'AUSENTES', 'JUSTIF.', '% ASIST.',
    ], [
        res['total'], res['presentes'], res['tardanzas'],
        res['ausentes'], res['justificados'], f"{res['porcentaje']}%",
    ]]
    rt = Table(resumen_data, colWidths=[4.2 * cm] * 6)
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, 1), LIGHT),
        ('TEXTCOLOR', (0, 1), (-1, 1), NAVY),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTSIZE', (0, 1), (-1, 1), 15),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, NAVY_MID),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    el.append(rt)
    el.append(Spacer(1, 16))

    # Tabla de registros
    # Anchos ajustados para 9 columnas en A4 horizontal (26.5 cm útiles):
    # N°, DNI, Alumno, Grado/Sección, Estado, Hora, Método, Apoderado, Teléfono
    cab = ['N°', 'DNI', 'Alumno', 'Grado / Sección', 'Estado', 'Hora', 'Método', 'Apoderado', 'Teléfono']
    filas = [cab]
    for i, r in enumerate(registros, 1):
        a   = r.alumno
        apo = getattr(a, 'apoderado', None)
        filas.append([
            str(i),
            a.dni,
            f'{a.apellido_paterno} {a.apellido_materno}, {a.nombres}',
            _grado_label(a.grado_seccion),
            ESTADO_LABEL.get(r.estado, r.estado),
            r.hora_registro.strftime('%H:%M') if r.hora_registro else '—',
            METODO_LABEL.get(r.metodo, r.metodo),
            apo.nombre_completo if apo else '—',
            apo.telefono_whatsapp if apo else '—',
        ])

    if len(filas) == 1:
        filas.append(['', '', 'Sin registros para los filtros seleccionados.',
                      '', '', '', '', '', ''])

    tabla = Table(
        filas,
        colWidths=[0.9*cm, 2.2*cm, 5.8*cm, 3.5*cm, 2.5*cm, 1.8*cm, 2.2*cm, 4.8*cm, 2.8*cm],
        repeatRows=1,
    )
    estilo = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_MID),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('TEXTCOLOR', (0, 1), (-1, -1), INK),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),   # N°
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),   # DNI
        ('ALIGN', (4, 0), (6, -1), 'CENTER'),   # Estado, Hora, Método
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, BORDER),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    color_estado = {
        'Presente':    colors.HexColor('#15803d'),
        'Tardanza':    colors.HexColor('#b45309'),
        'Ausente':     colors.HexColor('#b91c1c'),
        'Justificado': colors.HexColor('#1d4ed8'),
    }
    for idx, r in enumerate(registros, 1):
        if idx % 2 == 0:
            estilo.append(('BACKGROUND', (0, idx), (-1, idx), LIGHT))
        c = color_estado.get(ESTADO_LABEL.get(r.estado, r.estado))
        if c:
            estilo.append(('TEXTCOLOR', (4, idx), (4, idx), c))
            estilo.append(('FONTNAME', (4, idx), (4, idx), 'Helvetica-Bold'))
    tabla.setStyle(TableStyle(estilo))
    el.append(tabla)

    doc.build(el, onFirstPage=_pie_pagina, onLaterPages=_pie_pagina)
    buf.seek(0)
    return buf.read()
