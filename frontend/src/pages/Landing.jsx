import { useNavigate } from 'react-router-dom'
import './Landing.css'

/* ── Íconos ──────────────────────────────────────────────────────── */
const Arrow = (p) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)
const QRMark = () => (
  <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="1.6" stroke="#08182f" strokeWidth="2" />
    <rect x="5" y="5" width="4" height="4" fill="#08182f" />
    <rect x="16" y="2" width="10" height="10" rx="1.6" stroke="#08182f" strokeWidth="2" />
    <rect x="19" y="5" width="4" height="4" fill="#08182f" />
    <rect x="2" y="16" width="10" height="10" rx="1.6" stroke="#08182f" strokeWidth="2" />
    <rect x="5" y="19" width="4" height="4" fill="#08182f" />
    <rect x="16" y="16" width="4" height="4" fill="#08182f" />
    <rect x="22" y="16" width="4" height="4" fill="#08182f" />
    <rect x="16" y="22" width="4" height="4" fill="#08182f" />
    <rect x="22" y="22" width="4" height="4" fill="#08182f" />
  </svg>
)
const Sun = () => (
  <svg className="lp-sun" viewBox="0 0 100 100" aria-hidden="true">
    <g stroke="#fbbf24" strokeWidth="1" fill="none">
      <circle cx="50" cy="50" r="17" />
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 24
        return (
          <line key={i}
            x1={50 + Math.cos(a) * 21} y1={50 + Math.sin(a) * 21}
            x2={50 + Math.cos(a) * (i % 2 ? 30 : 34)} y2={50 + Math.sin(a) * (i % 2 ? 30 : 34)} />
        )
      })}
    </g>
  </svg>
)
const Greca = () => (
  <svg viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="lp-greca" x="0" y="0" width="40" height="26" patternUnits="userSpaceOnUse">
        <path d="M2 20 H10 V12 H18 V20 H26 V8 H34 V20 H40"
          stroke="#fbbf24" strokeWidth="2" fill="none" opacity="0.85" />
      </pattern>
    </defs>
    <rect width="120" height="26" fill="url(#lp-greca)" />
  </svg>
)
const Ico = ({ d }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

/* anchos pseudo-aleatorios pero estables para el código de barras */
const BARS = '4123214132412341231424132142314123412431'.split('').map(Number)

const PASOS = [
  { n: '1', t: 'Un carnet, un código', d: 'Cada alumno recibe su carnet con código de barras y QR basado en su DNI. Se imprime desde el sistema, listo en PDF.' },
  { n: '2', t: 'Escaneo en la puerta', d: 'El auxiliar escanea al ingresar. El sistema marca Presente o Tardanza según el horario del colegio, sin papel.' },
  { n: '3', t: 'El apoderado se entera', d: 'Al cerrar la sesión del día, los padres de ausentes y tardanzas reciben un WhatsApp automático.' },
]

const FEATURES = [
  { t: 'Escaneo en segundos', d: 'La sesión del día se abre sola con el primer escaneo. Sin configuración diaria.',
    i: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v-3" /></> },
  { t: 'Aviso a apoderados', d: 'WhatsApp automático a los padres por tardanza o inasistencia, al cierre del día.',
    i: <><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.7A8.5 8.5 0 1 1 21 11.5Z" /></> },
  { t: 'Justificaciones con control', d: 'Límite de 3 justificaciones por alumno; al alcanzarlo, el director es notificado.',
    i: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></> },
  { t: 'Cada colegio aislado', d: 'Su propio subdominio y su propio espacio de datos. Ningún colegio ve al otro.',
    i: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></> },
  { t: 'Anti-fraude', d: 'Detecta cuando se digita el DNI a mano en vez de escanear y alerta a dirección.',
    i: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="M9.5 12l2 2 3.5-4" /></> },
  { t: 'Reportes y carnets', d: 'Asistencia exportable y carnets imprimibles con código de barras y QR.',
    i: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></> },
]

export default function Landing() {
  const navigate = useNavigate()
  const irAlPanel = () => navigate('/plataforma/login')
  const year = new Date().getFullYear()

  return (
    <div className="lp">
      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-brand">
          <span className="lp-mark"><QRMark /></span>
          <span>
            <span className="lp-brand-name">Yachay<em>QR</em></span>
            <span className="lp-brand-tag">Asistencia escolar</span>
          </span>
        </div>
        {/* Acceso del dueño — discreto a propósito */}
        <button className="lp-access" onClick={irAlPanel}
          aria-label="Acceso al panel de administración">
          Acceso <Arrow width="14" height="14" />
        </button>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <header className="lp-hero">
        <Sun />
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow lp-eyebrow--light">Sistema de asistencia escolar</span>
            <h1 className="lp-h1">
              La asistencia, <em>clara como el sol</em>.
            </h1>
            <p className="lp-lead">
              YachayQR controla la entrada de cada alumno con un escaneo,
              avisa a los apoderados por WhatsApp y le da a cada colegio
              su propio espacio aislado. Sin cuadernos, sin dudas.
            </p>
            <div className="lp-cta-row">
              <a className="lp-btn" href="mailto:hola@yachayqr.pe?subject=Quiero%20una%20demo%20de%20YachayQR">
                Solicitar una demo <Arrow />
              </a>
              <a className="lp-btn-ghost" href="#como-funciona">Ver cómo funciona</a>
            </div>
          </div>

          {/* Carnet con haz de escaneo */}
          <div className="lp-scene">
            <div className="lp-card">
              <div className="lp-card-school">I.E. — Demo · YachayQR</div>
              <div className="lp-card-top">
                <div className="lp-avatar">
                  <Ico d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
                </div>
                <div className="lp-card-id">
                  <div className="n">María Quispe Mamani</div>
                  <div className="g">3.° "A" · Secundaria</div>
                </div>
              </div>
              <div className="lp-barcode" aria-hidden="true">
                {BARS.map((w, i) => (
                  <i key={i} style={{ width: w + 'px', opacity: i % 5 === 0 ? 0.55 : 1 }} />
                ))}
              </div>
              <div className="lp-code">7 0 1 2 3 4 5 6</div>
              <span className="lp-beam" aria-hidden="true" />
            </div>
            <span className="lp-ping" aria-hidden="true">
              <span className="dot" /> <b>Presente</b> · 07:42
            </span>
          </div>
        </div>
      </header>

      <div className="lp-greca"><Greca /></div>

      {/* ── CÓMO FUNCIONA ───────────────────────────────────── */}
      <section className="lp-section" id="como-funciona">
        <div className="lp-section-head">
          <span className="lp-eyebrow">Cómo funciona</span>
          <h2 className="lp-h2">Tres pasos entre la <em>puerta</em> y el apoderado.</h2>
        </div>
        <div className="lp-steps">
          {PASOS.map((p) => (
            <article className="lp-step" key={p.n}>
              <div className="lp-step-n">{p.n}</div>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="lp-feat-band">
        <div className="lp-section">
          <div className="lp-section-head">
            <span className="lp-eyebrow lp-eyebrow--light">Lo que incluye</span>
            <h2 className="lp-h2" style={{ color: '#fff' }}>
              Pensado para el <em>día a día</em> del colegio.
            </h2>
          </div>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <article className="lp-feat" key={f.t}>
                <div className="lp-feat-ico"><Ico d={f.i} /></div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRINCIPIOS ──────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-eyebrow">Por qué YachayQR</span>
          <h2 className="lp-h2">Diseñado para no fallar a las <em>7:30 a.m.</em></h2>
        </div>
        <div className="lp-principles">
          <div className="lp-pr">
            <div className="k">1 escaneo</div>
            <div className="v">Un solo gesto por alumno. La sesión del día se abre y se cierra sola.</div>
          </div>
          <div className="lp-pr">
            <div className="k">Aislado</div>
            <div className="v">Cada colegio en su propio schema y subdominio. Datos que nunca se mezclan.</div>
          </div>
          <div className="lp-pr">
            <div className="k">Sin papel</div>
            <div className="v">El registro, las justificaciones y el aviso al hogar, todo digital.</div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <span className="lp-eyebrow lp-eyebrow--light" style={{ justifyContent: 'center' }}>
            Empieza hoy
          </span>
          <h2>¿Listo para llevar tu colegio a <em>YachayQR</em>?</h2>
          <p>
            Te damos de alta tu colegio con su propio acceso y tu usuario Director.
            Escríbenos y coordinamos una demostración.
          </p>
          <a className="lp-btn" href="mailto:hola@yachayqr.pe?subject=Quiero%20YachayQR%20para%20mi%20colegio">
            Hablar con el equipo <Arrow />
          </a>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div>
          <div className="lp-footer-brand">Yachay<em>QR</em></div>
          <small>Control de asistencia escolar · Perú</small>
        </div>
        <div className="lp-footer-links">
          <a href="mailto:hola@yachayqr.pe" style={{ color: 'rgba(255,255,255,.42)', textDecoration: 'none' }}>
            Contacto
          </a>
          <button onClick={irAlPanel}>Acceso al panel</button>
          <small>© {year} YachayQR</small>
        </div>
      </footer>
    </div>
  )
}
