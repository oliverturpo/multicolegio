"""
carnet.py — Carnet estudiantil PDF (modelo tipo DNI peruano).

Reproduce fielmente el diseño de tarjeta de doble cara:
  • ANVERSO → escudo + nombre de la INSTITUCIÓN + logo · foto · datos
  • REVERSO → cabecera · código de barras (codigo_barras = DNI) · pie

Tamaño real DNI / ID-1: 85.6 × 54 mm. La maquetación interna se define
en el espacio de referencia de 339 × 215 px (el del diseño original) y
se escala a puntos PDF, así el resultado es idéntico al modelo.

Impresión a doble cara: hoja de ANVERSOS y hoja de REVERSOS; los
reversos van con la columna espejada para que calcen al voltear por
el borde largo.
"""

import io
import os
import barcode
import qrcode
from barcode.writer import ImageWriter
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# ── Paleta del modelo de referencia ───────────────────────────────
NAVY    = HexColor('#1e3a5f')
RED     = HexColor('#c41e3a')
LIGHT   = HexColor('#f8fafc')
BORDER  = HexColor('#e2e8f0')
GRAY    = HexColor('#64748b')
INK     = HexColor('#1e293b')
PHOTO_BG = HexColor('#f1f5f9')
FOOT    = HexColor('#374151')
WHITE   = white

# ── Espacio de diseño (px) y carnet real (pt) ─────────────────────
REF_W, REF_H = 339.0, 215.0                 # lienzo del diseño original
CARD_W = 85.6 / 25.4 * 72                    # 242.65 pt  (85.6 mm)
K      = CARD_W / REF_W                       # escala px → pt
CARD_H = REF_H * K                            # 153.9 pt  (~54 mm)

# ── Distribución en A4 (2 col × 4 fil = 8 por hoja) ───────────────
PAGE_W, PAGE_H = A4
COLS, ROWS = 2, 4
GAP_X, GAP_Y = 20, 16
GRID_W = COLS * CARD_W + (COLS - 1) * GAP_X
GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP_Y
MARGIN_X = (PAGE_W - GRID_W) / 2
MARGIN_Y = (PAGE_H - GRID_H) / 2

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
ESCUDO_PATH = os.path.join(ASSETS, 'escudo.png')


def _slots():
    """Lista de (ox, oy) por celda; índice = fila*COLS + col, fila 0 arriba."""
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            ox = MARGIN_X + c * (CARD_W + GAP_X)
            oy = MARGIN_Y + (ROWS - 1 - r) * (CARD_H + GAP_Y)
            out.append((ox, oy))
    return out

SLOTS = _slots()




# ── Resolución de institución ─────────────────────────────────────
def _nombre_institucion(override):
    if override:
        return str(override).strip()
    try:
        from django.db import connection
        t = getattr(connection, 'tenant', None)
        n = getattr(t, 'nombre', '') if t else ''
        if n:
            return n.strip()
    except Exception:
        pass
    return 'Institución Educativa'


# ── Helpers de imagen ─────────────────────────────────────────────
def _img_reader(path):
    """Lee una imagen preservando transparencia (PNG con alfa → sin fondo)."""
    if not path or not os.path.isfile(path):
        return None
    try:
        im = PILImage.open(path)
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            im = im.convert('RGBA')
        else:
            im = im.convert('RGB')
        buf = io.BytesIO()
        im.save(buf, format='PNG')
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _barcode(codigo):
    buf = io.BytesIO()
    w = ImageWriter()
    w.set_options({
        'module_height': 14, 'module_width': 0.40,
        'quiet_zone': 1, 'font_size': 0, 'text_distance': 0,
        'background': 'white', 'foreground': '#1e293b',
    })
    bc = barcode.get('code128', codigo, writer=w)
    bc.write(buf, options={'write_text': False})
    buf.seek(0)
    return ImageReader(buf)


def _qr(data):
    """QR del codigo_barras (mismo dato que escanea la lectora)."""
    q = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10, border=2,            # border=2 → zona de silencio (escaneable)
    )
    q.add_data(data)
    q.make(fit=True)
    img = q.make_image(fill_color='#1e293b', back_color='white').convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return ImageReader(buf)


# ── Conversión espacio-diseño (px, origen sup-izq) → PDF ──────────
class Card:
    """Dibuja en coordenadas px del diseño (origen arriba-izq)."""

    def __init__(self, c, ox, oy):
        self.c, self.ox, self.oy = c, ox, oy

    def _x(self, x): return self.ox + x * K
    def _yt(self, y): return self.oy + CARD_H - y * K     # borde superior a 'y'

    def rect(self, x, y, w, h, fill=None, stroke=None, lw=1.0, radius=0):
        c = self.c
        bx, by = self._x(x), self.oy + CARD_H - (y + h) * K
        if fill is not None:
            c.setFillColor(fill)
        if stroke is not None:
            c.setStrokeColor(stroke)
            c.setLineWidth(lw * K)
        if radius:
            c.roundRect(bx, by, w * K, h * K, radius * K,
                        fill=1 if fill is not None else 0,
                        stroke=1 if stroke is not None else 0)
        else:
            c.rect(bx, by, w * K, h * K,
                   fill=1 if fill is not None else 0,
                   stroke=1 if stroke is not None else 0)

    def line(self, x1, y1, x2, y2, color, lw=1.0):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(lw * K)
        self.c.line(self._x(x1), self._yt(y1), self._x(x2), self._yt(y2))

    def text(self, x, y, txt, size, color, bold=False, align='left',
             ls=0.0, max_w=None):
        """y = línea base en px (desde arriba). ls = letter-spacing px."""
        txt = str(txt)
        c = self.c
        font = 'Helvetica-Bold' if bold else 'Helvetica'
        sz = size * K
        track = ls * K

        def width(s):
            return c.stringWidth(s, font, sz) + track * max(len(s) - 1, 0)

        if max_w:
            mw = max_w * K
            while width(txt) > mw and sz > 3:
                sz -= 0.4
        w = width(txt)
        ax = self._x(x)
        start = ax if align == 'left' else (ax - w / 2 if align == 'center' else ax - w)
        t = c.beginText()
        t.setFont(font, sz)
        t.setFillColor(color)
        t.setCharSpace(track)
        t.setTextOrigin(start, self._yt(y))
        t.textOut(txt)
        c.drawText(t)

    def image(self, path, x, y, w, h, fit='contain'):
        r = _img_reader(path)
        if not r:
            return False
        bx, by = self._x(x), self.oy + CARD_H - (y + h) * K
        self.c.drawImage(r, bx, by, w * K, h * K,
                         preserveAspectRatio=(fit == 'contain'),
                         anchor='c', mask='auto')
        return True

    def draw_reader(self, reader, x, y, w, h):
        """Dibuja una imagen en memoria (ImageReader) en coords de diseño."""
        if not reader:
            return
        bx, by = self._x(x), self.oy + CARD_H - (y + h) * K
        self.c.drawImage(reader, bx, by, w * K, h * K,
                         preserveAspectRatio=True, anchor='c', mask='auto')

    def clip_round(self, radius):
        c = self.c
        p = c.beginPath()
        p.roundRect(self.ox, self.oy, CARD_W, CARD_H, radius * K)
        c.clipPath(p, stroke=0, fill=0)


# ── ANVERSO ───────────────────────────────────────────────────────
def _anverso(c, alumno, ox, oy, institucion, logo_path):
    g = alumno.grado_seccion
    nombre = f'{alumno.apellido_paterno} {alumno.apellido_materno}, {alumno.nombres}'
    dni = alumno.dni
    grado = getattr(g, 'grado', '')
    seccion = getattr(g, 'nombre_seccion', '') or '—'
    nivel = (getattr(g, 'get_nivel_display', lambda: '')() or 'Secundaria')
    anio = getattr(g, 'año_academico', '') or ''
    foto = alumno.foto.path if getattr(alumno, 'foto', None) else None
    inicial = (alumno.nombres or '?')[0].upper()

    card = Card(c, ox, oy)
    c.saveState()
    card.clip_round(14)

    # Cuerpo blanco
    card.rect(0, 0, REF_W, REF_H, fill=WHITE)

    # ── Header (escudo · institución · logo) ──────────────────────
    HH = 58
    card.rect(0, 0, REF_W, HH, fill=LIGHT)
    card.line(0, HH, REF_W, HH, NAVY, lw=2)
    if not card.image(ESCUDO_PATH, 14, 10, 38, 38):
        card.rect(14, 10, 38, 38, fill=BORDER, radius=19)
    card.text(REF_W / 2, 27, institucion.upper(), 11, NAVY, bold=True,
              align='center', ls=1, max_w=REF_W - 120)
    card.text(REF_W / 2, 40, 'CARNET ESTUDIANTIL', 7, RED, bold=True,
              align='center', ls=2)
    card.image(logo_path, REF_W - 14 - 38, 10, 38, 38)   # logo del colegio (si tiene)

    # ── Cuerpo (foto + datos) ─────────────────────────────────────
    PX, PY, PW, PH = 14, HH + 12, 82, 100
    if not card.image(foto, PX, PY, PW, PH, fit='cover'):
        card.rect(PX, PY, PW, PH, fill=PHOTO_BG)
        card.text(PX + PW / 2, PY + PH / 2 + 10, inicial, 40, GRAY,
                  bold=True, align='center')
    card.rect(PX, PY, PW, PH, stroke=NAVY, lw=2, radius=6)

    # Placa QR (abajo-derecha): no invade foto, datos ni footer
    QT = 70                       # lado de la placa
    QP = 5                        # padding interno (zona de silencio)
    qtx = REF_W - 14 - QT
    qty = (REF_H - 26) - 6 - QT   # 26 = alto del footer; 6 = margen

    ix = PX + PW + 14
    # El nombre va por encima de la placa QR → ancho completo
    card.text(ix, HH + 28, nombre, 13, INK, bold=True, max_w=REF_W - ix - 14)

    def fila(lbl, val, yy):
        card.text(ix, yy, lbl, 8, GRAY, bold=True, ls=0.5)
        # El valor se corta antes de la placa QR (nunca se solapa)
        card.text(ix + 46, yy, str(val), 10, INK, bold=True,
                  max_w=qtx - 8 - (ix + 46))

    fila('DNI', dni, HH + 52)
    fila('GRADO', f'{grado}° {nivel}', HH + 70)
    fila('SECCIÓN', seccion, HH + 88)

    card.rect(qtx, qty, QT, QT, fill=WHITE, stroke=BORDER, lw=1, radius=6)
    try:
        card.draw_reader(_qr(alumno.codigo_barras),
                         qtx + QP, qty + QP, QT - 2 * QP, QT - 2 * QP)
    except Exception:
        pass

    # ── Footer (año · badge) ──────────────────────────────────────
    FH = 26
    fy = REF_H - FH
    card.rect(0, fy, REF_W, FH, fill=LIGHT)
    card.line(0, fy, REF_W, fy, BORDER, lw=1)
    card.text(14, fy + 17, f'Año Lectivo {anio}', 9, NAVY, bold=True)
    bw = 64
    card.rect(REF_W - 14 - bw, fy + 6, bw, 15, fill=RED, radius=7)
    card.text(REF_W - 14 - bw / 2, fy + 16, 'ESTUDIANTE', 7, WHITE,
              bold=True, align='center', ls=1)

    c.restoreState()
    # Borde de la tarjeta
    c.setStrokeColor(NAVY)
    c.setLineWidth(2 * K)
    c.roundRect(ox, oy, CARD_W, CARD_H, 14 * K, fill=0, stroke=1)


# ── REVERSO ───────────────────────────────────────────────────────
def _reverso(c, alumno, ox, oy, institucion, logo_path):
    codigo = alumno.codigo_barras
    dni = alumno.dni

    card = Card(c, ox, oy)
    c.saveState()
    card.clip_round(14)
    card.rect(0, 0, REF_W, REF_H, fill=WHITE)

    # Header (logo izq · título centrado · escudo der)
    HH = 44
    card.line(0, HH, REF_W, HH, NAVY, lw=2)
    cx = REF_W / 2
    card.image(logo_path, 14, 11, 22, 22)                 # logo del colegio (si tiene)
    card.image(ESCUDO_PATH, REF_W - 14 - 22, 11, 22, 22)
    card.text(cx, 26, 'SISTEMA DE CONTROL DE ASISTENCIA', 8.5, NAVY,
              bold=True, align='center', ls=0.4, max_w=REF_W - 92)

    # Código de barras
    by = HH + 30
    bw, bh = REF_W - 80, 56
    bx = (REF_W - bw) / 2
    try:
        r = _barcode(codigo)
        gx, gy = card._x(bx), card.oy + CARD_H - (by + bh) * K
        c.drawImage(r, gx, gy, bw * K, bh * K,
                    preserveAspectRatio=False, mask='auto')
    except Exception:
        card.text(cx, by + bh / 2, codigo, 13, INK, bold=True, align='center')
    card.text(cx, by + bh + 22, f'DNI: {dni}', 14, INK, bold=True,
              align='center', ls=2)

    # Footer
    FY = REF_H - 44
    card.line(0, FY, REF_W, FY, BORDER, lw=1)
    card.text(cx, FY + 18, 'Este carnet es personal e intransferible', 7.5,
              INK, bold=True, align='center')
    card.text(cx, FY + 31,
              'En caso de pérdida comunicarse con la dirección de la institución.',
              7, FOOT, align='center', max_w=REF_W - 24)

    c.restoreState()
    c.setStrokeColor(NAVY)
    c.setLineWidth(2 * K)
    c.roundRect(ox, oy, CARD_W, CARD_H, 14 * K, fill=0, stroke=1)


# ── Guías de corte ────────────────────────────────────────────────
def _guias(c):
    c.saveState()
    c.setStrokeColor(HexColor('#cbd5e1'))
    c.setLineWidth(0.3)
    c.setDash(3, 4)
    for col in range(COLS + 1):
        x = MARGIN_X + col * CARD_W + max(col - 1, 0) * GAP_X + (GAP_X / 2 if 0 < col < COLS else 0)
        if col == 0:
            x = MARGIN_X - 6
        elif col == COLS:
            x = MARGIN_X + GRID_W + 6
        c.line(x, MARGIN_Y - 10, x, MARGIN_Y + GRID_H + 10)
    for row in range(ROWS + 1):
        y = MARGIN_Y + GRID_H - (row * CARD_H + max(row - 1, 0) * GAP_Y) - (GAP_Y / 2 if 0 < row < ROWS else 0)
        if row == 0:
            y = MARGIN_Y + GRID_H + 6
        elif row == ROWS:
            y = MARGIN_Y - 6
        c.line(MARGIN_X - 10, y, MARGIN_X + GRID_W + 10, y)
    c.restoreState()


# ── API pública ───────────────────────────────────────────────────
def generar_pdf_carnets(alumnos, institucion=None, logo_path=None):
    """
    Lista de Alumno → PDF (bytes).

    UNA SOLA HOJA por carnet: anverso y reverso del mismo alumno van
    lado a lado (columna izquierda = anverso, derecha = reverso). Se
    recorta el par y se pega/lamina cara con cara. Hasta 4 alumnos
    por hoja A4; 1 alumno = 1 hoja.
    """
    inst = _nombre_institucion(institucion)
    if logo_path and not os.path.isfile(logo_path):
        logo_path = None

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f'Carnets — {inst}')

    por_hoja = ROWS                       # 4 alumnos; las 2 cols = anverso|reverso
    grupos = [alumnos[i:i + por_hoja] for i in range(0, len(alumnos), por_hoja)] or [[]]
    for grupo in grupos:
        if not grupo:
            continue
        for k, al in enumerate(grupo):
            oxa, oya = SLOTS[2 * k]       # columna 0 → anverso
            oxr, oyr = SLOTS[2 * k + 1]   # columna 1 → reverso
            _anverso(c, al, oxa, oya, inst, logo_path)
            _reverso(c, al, oxr, oyr, inst, logo_path)
        _guias(c)
        c.showPage()

    c.save()
    buf.seek(0)
    return buf.read()
