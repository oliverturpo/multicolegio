import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import './Alumnos.css'

// ── Íconos ────────────────────────────────────────────────────────
const IcoSearch  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoClose   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoFilter  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IcoUser    = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoChevron = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
const IcoPhone   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.56 3.44 2 2 0 0 1 3.54 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.07 6.07l.9-.9a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
const IcoRefresh = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>

// ── Paleta de estados ─────────────────────────────────────────────
const ESTADO_CFG = {
  PRESENTE:    { label: 'Presente',    color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  TARDANZA:    { label: 'Tardanza',    color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  AUSENTE:     { label: 'Ausente',     color: '#dc2626', bg: '#fee2e2', border: '#fecaca' },
  JUSTIFICADO: { label: 'Justificado', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
}

// ── Helpers ───────────────────────────────────────────────────────
function Avatar({ nombre, foto, size = 36 }) {
  if (foto) return <img src={foto} alt={nombre} className="axalu-avatar-img" style={{ width: size, height: size }} />
  return (
    <div className="axalu-avatar" style={{ width: size, height: size }}>
      {(nombre || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function Spinner({ size = 20 }) {
  return <div className="axalu-spinner" style={{ width: size, height: size }} />
}

function RingPct({ pct = 0, size = 76 }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} className="axalu-ring-svg">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#fbbf24" strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="#0f2a4c">{pct}%</text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fontSize="9"  fontWeight="600" fill="#8b95a7">ASIST.</text>
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════
export default function AuxiliarAlumnos() {
  const [alumnos,     setAlumnos]     = useState([])
  const [grados,      setGrados]      = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [buscar,      setBuscar]      = useState('')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [errorGlobal, setErrorGlobal] = useState('')

  const [alumnoSelec,  setAlumnoSelec]  = useState(null)
  const [historial,    setHistorial]    = useState(null)
  const [cargandoHist, setCargandoHist] = useState(false)
  const [errorHist,    setErrorHist]    = useState('')

  // ── Cargar alumnos ───────────────────────────────────────────────
  const cargarAlumnos = useCallback(async () => {
    setCargando(true)
    setErrorGlobal('')
    try {
      const params = {}
      if (buscar.trim()) params.buscar = buscar.trim()
      if (filtroGrado)   params.grado  = filtroGrado
      const { data } = await api.get('/colegios/alumnos/', { params })
      setAlumnos(Array.isArray(data) ? data : (data.results ?? []))
    } catch {
      setErrorGlobal('No se pudo cargar la lista de alumnos.')
    } finally {
      setCargando(false)
    }
  }, [buscar, filtroGrado])

  useEffect(() => {
    api.get('/colegios/grados/').then(({ data }) => {
      setGrados(Array.isArray(data) ? data : (data.results ?? []))
    }).catch(() => {})
  }, [])

  // Debounce de búsqueda
  useEffect(() => {
    const t = setTimeout(cargarAlumnos, 350)
    return () => clearTimeout(t)
  }, [cargarAlumnos])

  // ── Seleccionar alumno → historial ───────────────────────────────
  const seleccionarAlumno = async (alumno) => {
    setAlumnoSelec(alumno)
    setHistorial(null)
    setErrorHist('')
    setCargandoHist(true)
    try {
      const { data } = await api.get(`/colegios/alumnos/${alumno.id}/historial/`)
      setHistorial(data)
    } catch {
      setErrorHist('No se pudo cargar el historial.')
    } finally {
      setCargandoHist(false)
    }
  }

  const cerrarPanel = () => {
    setAlumnoSelec(null)
    setHistorial(null)
    setErrorHist('')
  }

  const fmtFecha = (str) =>
    new Date(str + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })

  return (
    <div className="axalu-root">

      {/* ── CABECERA ─────────────────────────────────────────────── */}
      <div className="axalu-header">
        <div>
          <h1 className="axalu-title">Alumnos</h1>
          <p className="axalu-subtitle">
            {cargando
              ? 'Cargando…'
              : `${alumnos.length} alumno${alumnos.length !== 1 ? 's' : ''} encontrado${alumnos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="axalu-btn-ghost" onClick={cargarAlumnos} disabled={cargando}>
          <IcoRefresh /> Actualizar
        </button>
      </div>

      {/* ── TOOLBAR ──────────────────────────────────────────────── */}
      <div className="axalu-toolbar">
        <div className="axalu-search-wrap">
          <IcoSearch />
          <input
            className="axalu-search"
            placeholder="Nombre, DNI o código de barras…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
          />
          {buscar && (
            <button className="axalu-search-clear" onClick={() => setBuscar('')} title="Limpiar">
              <IcoClose />
            </button>
          )}
        </div>
        <div className="axalu-filter-wrap">
          <IcoFilter />
          <select
            className="axalu-select"
            value={filtroGrado}
            onChange={e => setFiltroGrado(e.target.value)}
          >
            <option value="">Todos los grados</option>
            {grados.map(g => (
              <option key={g.id} value={g.grado}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── ERROR ────────────────────────────────────────────────── */}
      {errorGlobal && <div className="axalu-error-banner">{errorGlobal}</div>}

      {/* ── LISTA ────────────────────────────────────────────────── */}
      {cargando ? (
        <div className="axalu-loading"><Spinner size={24} /> Cargando alumnos…</div>
      ) : alumnos.length === 0 ? (
        <div className="axalu-empty">
          <div className="axalu-empty-ico"><IcoUser /></div>
          <span>{buscar || filtroGrado ? 'Sin resultados para esta búsqueda.' : 'No hay alumnos registrados.'}</span>
        </div>
      ) : (
        <div className="axalu-tabla-wrap">
          <table className="axalu-tabla">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>DNI</th>
                <th>Grado / Sección</th>
                <th>Apoderado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map(a => (
                <tr
                  key={a.id}
                  className={`axalu-row${alumnoSelec?.id === a.id ? ' axalu-row--selec' : ''}`}
                  onClick={() => seleccionarAlumno(a)}
                >
                  <td className="axalu-td-nombre" data-label="Alumno">
                    <div className="axalu-nombre-cell">
                      <Avatar nombre={a.nombre_completo} foto={a.foto_url} size={36} />
                      <div className="axalu-nombre-wrap">
                        <span className="axalu-nombre">{a.nombre_completo}</span>
                        <span className="axalu-nombre-sub">{a.grado_label}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="DNI">
                    <span className="axalu-mono">{a.dni}</span>
                  </td>
                  <td data-label="Grado">
                    {a.grado_label}
                  </td>
                  <td data-label="Apoderado">
                    {a.apoderado
                      ? <span className="axalu-apo-nombre">{a.apoderado.nombre_completo}</span>
                      : <span className="axalu-text-soft">—</span>
                    }
                  </td>
                  <td className="axalu-td-ver" data-label="">
                    <span className="axalu-ver-btn">Ver <IcoChevron /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PANEL LATERAL ────────────────────────────────────────── */}
      {alumnoSelec && (
        <div className="axalu-overlay" onClick={cerrarPanel}>
          <div className="axalu-panel" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="axalu-panel-header">
              <h2 className="axalu-panel-title">Ficha del alumno</h2>
              <button className="axalu-panel-close" onClick={cerrarPanel}><IcoClose /></button>
            </div>

            <div className="axalu-panel-body">

              {/* ── Tarjeta de datos ──────────────────────────── */}
              <div className="axalu-ficha">
                <div className="axalu-ficha-top">
                  <Avatar nombre={alumnoSelec.nombre_completo} foto={alumnoSelec.foto_url} size={68} />
                  <div className="axalu-ficha-info">
                    <h3 className="axalu-ficha-nombre">{alumnoSelec.nombre_completo}</h3>
                    <p className="axalu-ficha-grado">{alumnoSelec.grado_label}</p>
                    <p className="axalu-ficha-dni">DNI: <strong>{alumnoSelec.dni}</strong></p>
                  </div>
                </div>

                {alumnoSelec.apoderado && (
                  <div className="axalu-apoderado">
                    <span className="axalu-apo-label">Apoderado</span>
                    <div className="axalu-apo-row">
                      <span className="axalu-apo-nombre-panel">{alumnoSelec.apoderado.nombre_completo}</span>
                      <span className="axalu-apo-parentesco">{alumnoSelec.apoderado.parentesco}</span>
                    </div>
                    {alumnoSelec.apoderado.telefono_whatsapp && (
                      <a
                        className="axalu-wsp-link"
                        href={`https://wa.me/51${alumnoSelec.apoderado.telefono_whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IcoPhone /> +51 {alumnoSelec.apoderado.telefono_whatsapp}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* ── Historial ─────────────────────────────────── */}
              <div className="axalu-hist-section">
                <h4 className="axalu-hist-title">Historial de asistencia</h4>

                {cargandoHist ? (
                  <div className="axalu-hist-loading">
                    <Spinner size={20} /> Cargando historial…
                  </div>
                ) : errorHist ? (
                  <p className="axalu-hist-error">{errorHist}</p>
                ) : historial ? (
                  <>
                    {/* Stats: ring + pills */}
                    <div className="axalu-stats-row">
                      <RingPct pct={historial.estadisticas.porcentaje} />
                      <div className="axalu-stats-pills">
                        {[
                          { key: 'presentes',    ...ESTADO_CFG.PRESENTE    },
                          { key: 'tardanzas',    ...ESTADO_CFG.TARDANZA    },
                          { key: 'ausentes',     ...ESTADO_CFG.AUSENTE     },
                          { key: 'justificados', ...ESTADO_CFG.JUSTIFICADO },
                        ].map(s => (
                          <div
                            key={s.key}
                            className="axalu-stat-pill"
                            style={{ background: s.bg, borderColor: s.border }}
                          >
                            <span className="axalu-stat-n" style={{ color: s.color }}>
                              {historial.estadisticas[s.key]}
                            </span>
                            <span className="axalu-stat-l">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Registros recientes */}
                    {historial.registros.length === 0 ? (
                      <p className="axalu-hist-empty">Sin registros aún.</p>
                    ) : (
                      <div className="axalu-registros">
                        {historial.registros.map((r, i) => {
                          const cfg = ESTADO_CFG[r.estado] ?? { label: r.estado, color: '#64748b', bg: '#f1f5f9' }
                          return (
                            <div key={i} className="axalu-reg-row">
                              <span className="axalu-reg-fecha">{fmtFecha(r.fecha)}</span>
                              <span
                                className="axalu-reg-badge"
                                style={{ color: cfg.color, background: cfg.bg }}
                              >
                                {cfg.label}
                              </span>
                              <span className="axalu-reg-hora">
                                {r.hora_registro ? r.hora_registro.slice(0, 5) : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
