/**
 * AsistenciasScreen — Director / Auxiliar.
 *   Director  → cambia cualquier estado + justifica (límite 3, con reinicio).
 *   Auxiliar  → solo TARDANZA → PRESENTE, solo hoy.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import './AsistenciasScreen.css'

// ── Íconos ───────────────────────────────────────────────────────
const IcoSearch  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoFilter  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IcoRefresh = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IcoClose   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoCheck   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoCal     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IcoInfo    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
const IcoScale   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>

// ── Config de estados ─────────────────────────────────────────────
const EST = {
  PRESENTE:    { suf: 'pre', label: 'Presente'    },
  TARDANZA:    { suf: 'tar', label: 'Tardanza'    },
  AUSENTE:     { suf: 'aus', label: 'Ausente'     },
  JUSTIFICADO: { suf: 'jus', label: 'Justificado' },
}

// ── Helpers ───────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().split('T')[0]
const fmtHora = (s) => (s ? s.slice(0, 5) : '—')
function fmtFechaLarga(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  const t = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Spinner({ size = 20 }) {
  return <span className="asi-spinner" style={{ width: size, height: size }} />
}
function Avatar({ nombre, foto, size = 46 }) {
  if (foto) return <img src={foto} alt={nombre} className="asi-avatar-img" style={{ width: size, height: size }} />
  return <div className="asi-avatar" style={{ width: size, height: size }}>{(nombre || '?').charAt(0).toUpperCase()}</div>
}
function Badge({ estado }) {
  const c = EST[estado] ?? { suf: '', label: estado }
  return <span className={`asi-badge asi-card--${c.suf}`}><span className="d" />{c.label}</span>
}

// Anillo de porcentaje (SVG)
function Ring({ value }) {
  const R = 30, C = 2 * Math.PI * R
  const off = C - (Math.min(100, Math.max(0, value)) / 100) * C
  return (
    <div className="asi-ring">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
        <circle cx="38" cy="38" r={R} fill="none" stroke="#fbbf24" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
          transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="asi-ring-num">{Math.round(value)}%<small>asist.</small></div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
export default function AsistenciasScreen({ rol }) {
  const esDirector = rol === 'DIRECTOR'
  const esAuxiliar = rol === 'AUXILIAR'

  const [fecha, setFecha]           = useState(hoy())
  const [sesion, setSesion]         = useState(null)
  const [registros, setRegistros]   = useState([])
  const [grados, setGrados]         = useState([])
  const [cargando, setCargando]     = useState(true)
  const [cargandoReg, setCargandoReg] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroGrado, setFiltroGrado]   = useState('')
  const [buscar, setBuscar]         = useState('')
  const [error, setError]           = useState('')
  const [accionId, setAccionId]     = useState(null)

  // Modal justificación
  const [jModal, setJModal]   = useState(null)   // registro
  const [motivo, setMotivo]   = useState('')
  const [contador, setContador] = useState(null) // {cantidad,restantes,limite,limite_alcanzado}
  const [warn, setWarn]       = useState(false)
  const [jLoad, setJLoad]     = useState(false)
  const [jMsg, setJMsg]       = useState(null)   // {tipo, txt}

  const timer = useRef()

  const cargarSesion = useCallback(async () => {
    try {
      const { data } = await api.get('/asistencia/sesiones/', { params: { fecha } })
      const l = data.results ?? data
      const s = Array.isArray(l) ? l[0] : null
      setSesion(s ?? null)
      return s ?? null
    } catch { setSesion(null); return null }
  }, [fecha])

  const cargarRegistros = useCallback(async (sid) => {
    if (!sid) { setRegistros([]); return }
    setCargandoReg(true)
    try {
      const params = { sesion: sid }
      if (filtroGrado) params.grado_id = filtroGrado
      if (buscar)      params.buscar   = buscar
      const { data } = await api.get('/asistencia/registros/', { params })
      setRegistros(data.results ?? data)
    } catch { setError('No se pudieron cargar los registros.') }
    finally { setCargandoReg(false) }
  }, [filtroGrado, buscar])

  const cargarGrados = useCallback(async () => {
    try {
      const { data } = await api.get('/colegios/grados/')
      setGrados(data.results ?? data)
    } catch { /* silencioso */ }
  }, [])

  const cargarTodo = useCallback(async () => {
    setCargando(true); setError('')
    const s = await cargarSesion()
    await cargarRegistros(s?.id)
    setCargando(false)
  }, [cargarSesion, cargarRegistros])

  useEffect(() => { cargarGrados() }, [cargarGrados])
  useEffect(() => { cargarTodo() }, [cargarTodo])

  const onBuscar = (v) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBuscar(v), 350)
  }

  const visibles = filtroEstado ? registros.filter(r => r.estado === filtroEstado) : registros

  // ── Cambio rápido de estado ────────────────────────────────────
  const cambiar = async (registro, nuevo) => {
    setAccionId(registro.id); setError('')
    try {
      await api.patch(`/asistencia/registros/${registro.id}/cambiar-estado/`, { estado: nuevo })
      setRegistros(prev => prev.map(r => r.id === registro.id ? { ...r, estado: nuevo } : r))
      await cargarSesion()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar el estado.')
    } finally { setAccionId(null) }
  }

  // ── Modal justificación ────────────────────────────────────────
  const abrirJustif = async (registro) => {
    setJModal(registro); setMotivo(''); setWarn(false); setJMsg(null); setContador(null)
    try {
      const { data } = await api.get(`/asistencia/registros/${registro.id}/justificacion-info/`)
      setContador(data)
    } catch { /* sin contador, igual se puede justificar */ }
  }

  const enviarJustif = async (forceReset = false) => {
    if (!motivo.trim()) { setJMsg({ tipo: 'err', txt: 'El motivo es obligatorio.' }); return }
    setJLoad(true); setJMsg(null)
    try {
      await api.patch(`/asistencia/registros/${jModal.id}/cambiar-estado/`, {
        estado: 'JUSTIFICADO',
        motivo: motivo.trim(),
        force_reset: forceReset,
      })
      setJMsg({ tipo: 'ok', txt: 'Justificación registrada.' })
      setRegistros(prev => prev.map(r => r.id === jModal.id ? { ...r, estado: 'JUSTIFICADO' } : r))
      await cargarSesion()
      setTimeout(() => setJModal(null), 1000)
    } catch (err) {
      const d = err.response?.data
      if (d?.requires_confirmation || d?.limite_alcanzado) {
        setWarn(true)
        setContador(c => ({ ...(c || {}), cantidad: d.cantidad ?? c?.cantidad, limite: d.limite ?? c?.limite ?? 3 }))
      } else {
        setJMsg({ tipo: 'err', txt: d?.error || 'No se pudo justificar.' })
      }
    } finally { setJLoad(false) }
  }

  // ── Acciones por rol ───────────────────────────────────────────
  const accionesDe = (r) => {
    if (esDirector) {
      const quick = [
        { k: 'PRESENTE', cls: 'asi-q--p', t: 'Presente', c: 'P' },
        { k: 'TARDANZA', cls: 'asi-q--t', t: 'Tardanza', c: 'T' },
        { k: 'AUSENTE',  cls: 'asi-q--f', t: 'Falta',    c: 'F' },
      ].filter(b => b.k !== r.estado)
      return (
        <div className="asi-acc">
          {(r.estado === 'TARDANZA' || r.estado === 'AUSENTE') && (
            <button className="asi-q asi-q--j" title="Justificar"
              disabled={accionId === r.id} onClick={() => abrirJustif(r)}>
              <IcoScale /> Justificar
            </button>
          )}
          {quick.map(b => (
            <button key={b.k} className={`asi-q ${b.cls}`} title={`Cambiar a ${b.t}`}
              disabled={accionId === r.id} onClick={() => cambiar(r, b.k)}>
              {b.c}
            </button>
          ))}
        </div>
      )
    }
    if (esAuxiliar && fecha === hoy() && r.estado === 'TARDANZA') {
      return (
        <button className="asi-q-aux" disabled={accionId === r.id}
          onClick={() => cambiar(r, 'PRESENTE')}>
          {accionId === r.id ? <Spinner size={14} /> : <IcoCheck />} Marcar Presente
        </button>
      )
    }
    return null
  }

  // ── Stats ──────────────────────────────────────────────────────
  const pills = sesion ? [
    { k: 'PRESENTE',    n: sesion.total_presentes,    l: 'Presentes'    },
    { k: 'TARDANZA',    n: sesion.total_tardanzas,    l: 'Tardanzas'    },
    { k: 'AUSENTE',     n: sesion.total_ausentes,     l: 'Ausentes'     },
    { k: 'JUSTIFICADO', n: sesion.total_justificados, l: 'Justificados' },
  ] : []

  const pillColor = { PRESENTE:'#16a34a', TARDANZA:'#d97706', AUSENTE:'#dc2626', JUSTIFICADO:'#2563eb' }

  return (
    <div className="asi asi-root">

      {/* CABECERA */}
      <div className="asi-header">
        <div>
          <h1 className="asi-title">Asis<em>tencias</em></h1>
          <p className="asi-subtitle">
            {cargando ? 'Cargando…'
              : sesion ? `Sesión ${sesion.estado.toLowerCase()} · ${registros.length} registro${registros.length !== 1 ? 's' : ''}`
              : 'Sin sesión para esta fecha'}
          </p>
        </div>
        <div className="asi-fecha-wrap">
          <IcoCal />
          <input type="date" className="asi-fecha-input" value={fecha}
            max={hoy()} onChange={e => setFecha(e.target.value)} />
        </div>
      </div>

      {/* SESIÓN */}
      {sesion && (
        <div className="asi-sesion">
          <Ring value={sesion.porcentaje_asistencia ?? 0} />
          <div className="asi-sesion-meta">
            <span className="asi-sesion-estado">
              <span className={`asi-sesion-dot asi-sesion-dot--${sesion.estado.toLowerCase()}`} />
              Sesión {sesion.estado.toLowerCase()}
            </span>
            <div className="asi-sesion-fecha">{fmtFechaLarga(sesion.fecha)}</div>
            <div className="asi-sesion-horas">
              Apertura {fmtHora(sesion.hora_apertura_real)}
              {sesion.hora_cierre_real && ` · Cierre ${fmtHora(sesion.hora_cierre_real)}`}
            </div>
          </div>
          <div className="asi-pills">
            {pills.map(p => {
              const active = filtroEstado === p.k
              return (
                <button key={p.k}
                  className={`asi-pill ${active ? 'asi-pill--active' : ''}`}
                  style={active ? { color: pillColor[p.k] } : {}}
                  onClick={() => setFiltroEstado(active ? '' : p.k)}>
                  <span className="asi-pill-n">{p.n ?? 0}</span>
                  <span className="asi-pill-l">{p.l}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="asi-toolbar">
        <div className="asi-search-wrap">
          <IcoSearch />
          <input className="asi-search" type="text"
            placeholder="Buscar alumno por nombre o DNI…"
            onChange={e => onBuscar(e.target.value)} />
        </div>
        <div className="asi-filter-wrap">
          <IcoFilter />
          <select className="asi-select" value={filtroGrado}
            onChange={e => setFiltroGrado(e.target.value)}>
            <option value="">Todas las secciones</option>
            {grados.map(g => (
              <option key={g.id} value={g.id}>
                {g.grado}° "{g.nombre_seccion}" — {g.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria'}
              </option>
            ))}
          </select>
        </div>
        <button className="asi-btn-ghost" onClick={cargarTodo} title="Actualizar">
          <IcoRefresh /> Actualizar
        </button>
      </div>

      {error && <div className="asi-error-banner">⚠ {error}</div>}

      {/* CONTENIDO */}
      {cargando ? (
        <div className="asi-empty"><Spinner size={28} /><span>Cargando…</span></div>
      ) : !sesion ? (
        <div className="asi-sin-sesion">
          <div className="asi-sin-sesion-ico"><IcoInfo /></div>
          <p className="asi-sin-sesion-titulo">Sin sesión el {fmtFechaLarga(fecha)}</p>
          <p className="asi-sin-sesion-desc">
            {fecha === hoy()
              ? 'Aún no se ha registrado asistencia hoy. La sesión se abre sola con el primer escaneo.'
              : 'No hubo clases ese día o no se registró asistencia.'}
          </p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="asi-empty">
          <span>No hay registros{filtroEstado ? ` con estado "${EST[filtroEstado]?.label}"` : ''}.</span>
        </div>
      ) : (
        <div className="asi-lista">
          {cargandoReg && <div className="asi-lista-loading"><Spinner size={24} /></div>}
          {visibles.map((r, i) => {
            const suf = EST[r.estado]?.suf ?? ''
            return (
              <div key={r.id} className={`asi-card asi-card--${suf}`}
                style={{ animationDelay: `${Math.min(i * 28, 360)}ms` }}>
                <Avatar nombre={r.alumno?.nombre_completo} foto={r.alumno?.foto_url} />
                <div className="asi-info">
                  <p className="asi-nombre">{r.alumno?.nombre_completo ?? '—'}</p>
                  <p className="asi-meta">
                    <b>{r.alumno?.grado_label ?? '—'}</b> · DNI {r.alumno?.dni ?? '—'}
                  </p>
                </div>
                <div className="asi-estado-col">
                  <div className="asi-hora">{fmtHora(r.hora_registro)}<small>hora</small></div>
                  <Badge estado={r.estado} />
                  {accionId === r.id ? <Spinner size={18} /> : accionesDe(r)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL JUSTIFICACIÓN */}
      {jModal && (
        <div className="asi-ov" onClick={e => e.target === e.currentTarget && !jLoad && setJModal(null)}>
          <div className="asi-modal">
            <div className="asi-modal-h">
              <div>
                <h3>Justificar asistencia</h3>
                <p>Registrar motivo de {jModal.estado === 'TARDANZA' ? 'tardanza' : 'inasistencia'}</p>
              </div>
              <button className="asi-modal-x" onClick={() => !jLoad && setJModal(null)}><IcoClose /></button>
            </div>

            <div className="asi-modal-b">
              <div className="asi-stu">
                <Avatar nombre={jModal.alumno?.nombre_completo} foto={jModal.alumno?.foto_url} size={42} />
                <div className="asi-stu-i">
                  <div className="asi-stu-n">{jModal.alumno?.nombre_completo}</div>
                  <div className="asi-stu-m">{jModal.alumno?.grado_label} · DNI {jModal.alumno?.dni}</div>
                </div>
                <Badge estado={jModal.estado} />
              </div>

              {contador && (
                <div className="asi-cont">
                  <span>📋</span>
                  <div style={{ flex: 1 }}>
                    <div><b>{contador.cantidad ?? 0}</b> de {contador.limite ?? 3} justificaciones
                      {typeof contador.restantes === 'number' && ` · ${contador.restantes} restantes`}</div>
                    <div className="bar" style={{ marginTop: 6 }}>
                      <i style={{ width: `${Math.min(100, ((contador.cantidad ?? 0) / (contador.limite ?? 3)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {warn && (
                <div className="asi-warn">
                  <div className="asi-warn-t">⚠️ Límite de justificaciones alcanzado</div>
                  <p className="asi-warn-d">
                    {jModal.alumno?.nombre_completo} ya tiene {contador?.cantidad ?? 3} justificaciones.
                    Si confirmas, el contador se reinicia a 0 y esta será la primera del nuevo ciclo.
                  </p>
                </div>
              )}

              <label className="asi-lbl">Motivo de justificación *</label>
              <textarea className="asi-ta" value={motivo} disabled={jLoad}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Certificado médico presentado, cita programada…" />

              {jMsg && (
                <div className={`asi-modal-msg asi-modal-msg--${jMsg.tipo}`}>
                  {jMsg.tipo === 'ok' ? '✓ ' : '⚠ '}{jMsg.txt}
                </div>
              )}
            </div>

            <div className="asi-modal-f">
              <button className="asi-btn-cancel" disabled={jLoad}
                onClick={() => setJModal(null)}>Cancelar</button>
              {warn ? (
                <button className="asi-btn-reset" disabled={jLoad}
                  onClick={() => enviarJustif(true)}>
                  {jLoad ? <><Spinner size={15} /> Procesando…</> : 'Confirmar y reiniciar contador'}
                </button>
              ) : (
                <button className="asi-btn-primary" disabled={jLoad || !motivo.trim()}
                  onClick={() => enviarJustif(false)}>
                  {jLoad ? <><Spinner size={15} /> Procesando…</> : 'Justificar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
