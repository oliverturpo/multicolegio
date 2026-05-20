import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import './Dashboard.css'

// ── Íconos ───────────────────────────────────────────────────────
const IcoAlumnos  = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IcoPresente = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
const IcoTardanza = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IcoAusente  = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
const IcoEscaner  = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="21" x2="21" y2="21"/></svg>
const IcoReportes = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
const IcoUsuarios = ({ size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoEditar   = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoRefresh  = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IcoArrow    = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>

// ── Helpers ───────────────────────────────────────────────────────
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fechaHoy() {
  const d = new Date()
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}
function fmtHora(str) {
  if (!str) return '--:--'
  return str.slice(0, 5)
}

const ESTADO_CONFIG = {
  PRESENTE:    { label: 'Presente',    color: '#15803d', bg: '#ecfdf3' },
  TARDANZA:    { label: 'Tardanza',    color: '#b45309', bg: '#fffbeb' },
  AUSENTE:     { label: 'Ausente',     color: '#b91c1c', bg: '#fef2f2' },
  JUSTIFICADO: { label: 'Justificado', color: '#1d4ed8', bg: '#eff4ff' },
}

// ── Anillo de progreso — Fraunces + trazo animado al montar ───────
function RingProgress({ pct, size = 168, stroke = 9 }) {
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const target = circ - (Math.min(Math.max(pct, 0), 100) / 100) * circ

  // Anima el trazo desde "vacío" hasta el valor real una sola vez
  const [dash, setDash] = useState(circ)
  useEffect(() => {
    const t = setTimeout(() => setDash(target), 140)
    return () => clearTimeout(t)
  }, [target])

  return (
    <svg width={size} height={size} className="ring-svg">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.12)"
        strokeWidth={stroke}
      />
      <circle
        className="ring-arc"
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="#fbbf24"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dash}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text
        className="ring-pct"
        x="50%" y="50%"
        textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize="40" fontWeight="600"
      >
        {pct.toFixed(0)}<tspan fontSize="20" dy="-1" fill="#fbbf24">%</tspan>
      </text>
    </svg>
  )
}

// ── Componente principal ──────────────────────────────────────────
export default function DirectorDashboard() {
  const navigate = useNavigate()

  const [sesion,      setSesion]      = useState(null)
  const [horario,     setHorario]     = useState(null)
  const [registros,   setRegistros]   = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [procesando,  setProcesando]  = useState(false)
  const [editando,    setEditando]    = useState(false)
  const [formHorario, setFormHorario] = useState({})
  const [error,       setError]       = useState('')
  const [guardando,   setGuardando]   = useState(false)

  // ── Datos ─────────────────────────────────────────────────────
  const cargarSesion = useCallback(async () => {
    try {
      const { data } = await api.get('/asistencia/sesiones/hoy/')
      setSesion(data.sesion ?? null)
      if (data.sesion?.id) {
        const r = await api.get(`/asistencia/registros/?sesion=${data.sesion.id}`)
        setRegistros(r.data.results ?? r.data)
      } else {
        setRegistros([])
      }
    } catch {
      setError('No se pudo cargar la sesión.')
    }
  }, [])

  const cargarHorario = useCallback(async () => {
    try {
      const { data } = await api.get('/asistencia/horarios/')
      const lista  = data.results ?? data
      const activo = lista.find(h => h.activo) ?? lista[0] ?? null
      setHorario(activo)
    } catch {
      setError('No se pudo cargar el horario.')
    }
  }, [])

  useEffect(() => {
    setCargando(true)
    Promise.all([cargarSesion(), cargarHorario()]).finally(() => setCargando(false))
  }, [cargarSesion, cargarHorario])

  useEffect(() => {
    if (sesion?.estado !== 'ABIERTA') return
    const id = setInterval(cargarSesion, 30_000)
    return () => clearInterval(id)
  }, [sesion?.estado, cargarSesion])

  // ── Acciones ──────────────────────────────────────────────────
  const cerrarSesion = async () => {
    if (!confirm('¿Cerrar la sesión? Se marcarán ausentes todos los alumnos sin registro.')) return
    setProcesando(true); setError('')
    try {
      const { data } = await api.post(`/asistencia/sesiones/${sesion.id}/cerrar/`)
      setSesion(data)
      await cargarSesion()
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cerrar la sesión.')
    } finally { setProcesando(false) }
  }

  const iniciarEdicion = () => {
    setFormHorario({
      nombre:              horario?.nombre              || 'Horario Principal',
      hora_entrada:        fmtHora(horario?.hora_entrada),
      hora_limite_puntual: fmtHora(horario?.hora_limite_puntual),
      hora_cierre:         fmtHora(horario?.hora_cierre),
    })
    setEditando(true)
  }

  const guardarHorario = async (e) => {
    e.preventDefault()
    setGuardando(true); setError('')
    try {
      const payload = {
        nombre:              formHorario.nombre,
        hora_entrada:        formHorario.hora_entrada + ':00',
        hora_limite_puntual: formHorario.hora_limite_puntual + ':00',
        hora_cierre:         formHorario.hora_cierre + ':00',
        activo:              true,
        dias_laborables:     horario?.dias_laborables ?? [0,1,2,3,4],
      }
      if (horario?.id) {
        const { data } = await api.patch(`/asistencia/horarios/${horario.id}/`, payload)
        setHorario(data)
      } else {
        const { data } = await api.post('/asistencia/horarios/', payload)
        setHorario(data)
      }
      setEditando(false)
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo guardar el horario.')
    } finally { setGuardando(false) }
  }

  // ── Computed ──────────────────────────────────────────────────
  const pct       = sesion?.porcentaje_asistencia ?? 0
  const presentes = sesion?.total_presentes  ?? 0
  const tardanzas = sesion?.total_tardanzas  ?? 0
  const ausentes  = sesion?.total_ausentes   ?? 0
  const total     = sesion?.total_alumnos    ?? 0

  if (cargando) return (
    <div className="dash-loading">
      <div className="dash-spinner" />
      <span>Cargando panel…</span>
    </div>
  )

  return (
    <div className="dash">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <div className="dash-hero">
        <div className="hero-grid" />
        <div className="hero-bloom" />
        <div className="hero-frame" />

        <div className="hero-left">
          <span className="hero-eyebrow">YachayQR · Control de asistencia</span>

          <div className={`hero-status-pill hero-status-pill--${sesion?.estado === 'ABIERTA' ? 'abierta' : sesion ? 'cerrada' : 'sin'}`}>
            <span className="hero-dot" />
            {sesion?.estado === 'ABIERTA' ? 'Sesión en curso' : sesion ? 'Sesión cerrada' : 'Sin sesión hoy'}
          </div>

          <div className="hero-titles">
            <h1 className="hero-title">Panel del <em>Director</em></h1>
            <p className="hero-fecha">{fechaHoy()}</p>
          </div>

          {sesion ? (
            <div className="hero-stats-row">
              <div className="hero-stat" style={{ color: '#6ee7a8' }}>
                <span className="hero-stat-val">{presentes}</span>
                <span className="hero-stat-lbl">Presentes</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat" style={{ color: '#fbbf24' }}>
                <span className="hero-stat-val">{tardanzas}</span>
                <span className="hero-stat-lbl">Tardanzas</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat" style={{ color: '#f87171' }}>
                <span className="hero-stat-val">{ausentes}</span>
                <span className="hero-stat-lbl">Ausentes</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <span className="hero-stat-val">{total}</span>
                <span className="hero-stat-lbl">Total</span>
              </div>
            </div>
          ) : (
            <p className="hero-sin-sesion-msg">
              La sesión se abre automáticamente al primer escaneo dentro del horario.
            </p>
          )}

          <div className="hero-actions">
            <button className="hero-btn hero-btn--primary" onClick={() => navigate('/director/escaner')}>
              <IcoEscaner size={17} /> Ir al escáner
            </button>
            {sesion?.estado === 'ABIERTA' && (
              <button className="hero-btn hero-btn--danger" onClick={cerrarSesion} disabled={procesando}>
                {procesando ? <span className="btn-spin btn-spin--dark" /> : '⏹ Cerrar sesión'}
              </button>
            )}
            <button className="hero-btn hero-btn--ghost" onClick={() => { cargarSesion(); cargarHorario() }}>
              <IcoRefresh size={15} /> Actualizar
            </button>
          </div>
        </div>

        {sesion && (
          <div className="hero-ring">
            <RingProgress pct={pct} size={168} stroke={9} />
          </div>
        )}
      </div>

      {/* ── ERROR ─────────────────────────────────────────────────── */}
      {error && (
        <div className="dash-error">
          ⚠ {error}
          <button className="dash-error-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── STAT CARDS ────────────────────────────────────────────── */}
      {sesion && (
        <div className="dash-stats">
          {[
            { idx: '01', label: 'Total alumnos', valor: total,     icon: <IcoAlumnos size={20} />,  color: '#0f2a4c' },
            { idx: '02', label: 'Presentes',     valor: presentes, icon: <IcoPresente size={20} />, color: '#15803d' },
            { idx: '03', label: 'Tardanzas',     valor: tardanzas, icon: <IcoTardanza size={20} />, color: '#b45309' },
            { idx: '04', label: 'Ausentes',      valor: ausentes,  icon: <IcoAusente size={20} />,  color: '#b91c1c' },
          ].map((s) => (
            <div key={s.label} className="stat-card" style={{ '--sc': s.color }}>
              <span className="stat-accent" />
              <span className="stat-index">{s.idx}</span>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-body">
                <span className="stat-valor">{s.valor}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── COLUMNAS: Sesión + Horario ─────────────────────────────── */}
      <div className="dash-cols">

        {/* Sesión */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <span className="card-num">01</span>
              Sesión de hoy
            </h2>
            {sesion && (
              <span className={`sesion-badge sesion-badge--${sesion.estado.toLowerCase()}`}>
                {sesion.estado}
              </span>
            )}
          </div>

          {sesion ? (
            <div className="sesion-info">
              <div className="sesion-row">
                <span className="sesion-key">Apertura real</span>
                <span className="sesion-val">{fmtHora(sesion.hora_apertura_real)}</span>
              </div>
              {sesion.hora_cierre_real && (
                <div className="sesion-row">
                  <span className="sesion-key">Cierre real</span>
                  <span className="sesion-val">{fmtHora(sesion.hora_cierre_real)}</span>
                </div>
              )}
              <div className="sesion-row">
                <span className="sesion-key">Registros</span>
                <span className="sesion-val">{presentes + tardanzas} / {total}</span>
              </div>
              <div className="sesion-progress">
                <div className="sesion-progress-track">
                  <div className="sesion-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="sesion-progress-pct">{pct.toFixed(1)}%</span>
              </div>
              {sesion.estado === 'ABIERTA' && (
                <button className="dash-btn dash-btn--danger" onClick={cerrarSesion} disabled={procesando}>
                  {procesando ? <span className="btn-spin" /> : '⏹ Cerrar sesión'}
                </button>
              )}
              {sesion.estado === 'CERRADA' && (
                <div className="sesion-cerrada-msg">✅ Sesión cerrada · WhatsApp en cola</div>
              )}
            </div>
          ) : (
            <div className="sesion-info">
              <div className="sesion-esperando">
                <div className="esperando-dot" />
                <div>
                  <p className="esperando-titulo">Esperando primer escaneo</p>
                  <p className="esperando-desc">
                    La sesión se abre automáticamente cuando el auxiliar
                    escanee el primer carnet dentro del horario permitido.
                  </p>
                </div>
              </div>
              <div className="sesion-row">
                <span className="sesion-key">Ventana de entrada</span>
                <span className="sesion-val">{fmtHora(horario?.hora_entrada)} – {fmtHora(horario?.hora_cierre)}</span>
              </div>
              <div className="sesion-row">
                <span className="sesion-key">Tardanza a partir de</span>
                <span className="sesion-val">{fmtHora(horario?.hora_limite_puntual)}</span>
              </div>
              <p className="sesion-nota-dia">Si nadie escanea hoy, ese día no se registrará sesión.</p>
            </div>
          )}
        </div>

        {/* Horario */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <span className="card-num">02</span>
              Horario escolar
            </h2>
            {!editando && (
              <button className="dash-edit-btn" onClick={iniciarEdicion}>
                <IcoEditar size={14} /> Editar
              </button>
            )}
          </div>

          {editando ? (
            <form className="horario-form" onSubmit={guardarHorario}>
              <div className="hf-group">
                <label>Nombre del horario</label>
                <input type="text" value={formHorario.nombre}
                  onChange={e => setFormHorario(p => ({ ...p, nombre: e.target.value }))} required />
              </div>
              <div className="hf-row">
                <div className="hf-group">
                  <label>Entrada</label>
                  <input type="time" value={formHorario.hora_entrada}
                    onChange={e => setFormHorario(p => ({ ...p, hora_entrada: e.target.value }))} required />
                </div>
                <div className="hf-group">
                  <label>Límite puntual</label>
                  <input type="time" value={formHorario.hora_limite_puntual}
                    onChange={e => setFormHorario(p => ({ ...p, hora_limite_puntual: e.target.value }))} required />
                </div>
                <div className="hf-group">
                  <label>Cierre</label>
                  <input type="time" value={formHorario.hora_cierre}
                    onChange={e => setFormHorario(p => ({ ...p, hora_cierre: e.target.value }))} required />
                </div>
              </div>
              <div className="hf-actions">
                <button type="submit" className="dash-btn dash-btn--primary" disabled={guardando}>
                  {guardando ? <span className="btn-spin" /> : 'Guardar'}
                </button>
                <button type="button" className="dash-btn dash-btn--ghost" onClick={() => setEditando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="horario-info">
              {horario ? (
                <>
                  <p className="horario-nombre">{horario.nombre || 'Horario Principal'}</p>
                  <div className="horario-timeline">
                    <div className="ht-item">
                      <div className="ht-dot ht-dot--green" />
                      <div className="ht-info">
                        <span className="ht-label">Entrada</span>
                        <span className="ht-val">{fmtHora(horario.hora_entrada)}</span>
                      </div>
                    </div>
                    <div className="ht-line" />
                    <div className="ht-item">
                      <div className="ht-dot ht-dot--amber" />
                      <div className="ht-info">
                        <span className="ht-label">Límite puntualidad</span>
                        <span className="ht-val">{fmtHora(horario.hora_limite_puntual)}</span>
                      </div>
                    </div>
                    <div className="ht-line" />
                    <div className="ht-item">
                      <div className="ht-dot ht-dot--red" />
                      <div className="ht-info">
                        <span className="ht-label">Cierre sesión</span>
                        <span className="ht-val">{fmtHora(horario.hora_cierre)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="horario-nota">
                    Después de las {fmtHora(horario.hora_limite_puntual)} se registra como <strong>Tardanza</strong>
                  </div>
                </>
              ) : (
                <div className="horario-empty">
                  <p>No hay horario configurado.</p>
                  <button className="dash-btn dash-btn--primary" onClick={iniciarEdicion}>
                    Configurar horario
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ACCESOS RÁPIDOS ───────────────────────────────────────── */}
      <div className="dash-section">
        <p className="section-label">Accesos rápidos</p>
        <div className="actions-grid">
          {[
            { num: '01', path: '/director/escaner',  icon: <IcoEscaner size={20} />,  label: 'Escáner',  desc: 'Registrar asistencia'  },
            { num: '02', path: '/director/alumnos',  icon: <IcoAlumnos size={20} />,  label: 'Alumnos',  desc: 'Gestionar estudiantes' },
            { num: '03', path: '/director/reportes', icon: <IcoReportes size={20} />, label: 'Reportes', desc: 'Exportar Excel / PDF'  },
            { num: '04', path: '/director/usuarios', icon: <IcoUsuarios size={20} />, label: 'Usuarios', desc: 'Gestionar personal'    },
          ].map((a) => (
            <div key={a.path} className="action-card" onClick={() => navigate(a.path)}>
              <span className="action-card-num">{a.num}</span>
              <div className="action-card-icon">{a.icon}</div>
              <div className="action-card-body">
                <p className="action-card-label">{a.label}</p>
                <p className="action-card-desc">{a.desc}</p>
              </div>
              <div className="action-card-arrow"><IcoArrow size={16} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ÚLTIMOS REGISTROS ─────────────────────────────────────── */}
      {registros.length > 0 && (
        <div className="dash-card dash-card--full">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <span className="card-num">03</span>
              Últimos registros
            </h2>
            <span className="registros-count">{registros.length} registros</span>
          </div>
          <div className="registros-tabla">
            <div className="reg-head">
              <span>Alumno</span>
              <span>Sección</span>
              <span>Hora</span>
              <span>Estado</span>
            </div>
            {[...registros].reverse().slice(0, 15).map((r) => {
              const cfg = ESTADO_CONFIG[r.estado] ?? { label: r.estado, color: '#64748b', bg: '#f1f3f7' }
              return (
                <div key={r.id} className="reg-row">
                  <span className="reg-nombre">{r.alumno?.nombre_completo ?? '—'}</span>
                  <span className="reg-seccion">{r.alumno?.grado_label ?? '—'}</span>
                  <span className="reg-hora">{fmtHora(r.hora_registro)}</span>
                  <span className="reg-estado" style={{ color: cfg.color }}>
                    <span className="reg-dot" style={{ background: cfg.color }} />
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
