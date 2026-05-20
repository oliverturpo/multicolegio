import { useState, useEffect, useCallback } from 'react'
import api, { API_BASE } from '../../services/api'
import './Reportes.css'

// ── Íconos ───────────────────────────────────────────────────────
const IcoCal     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IcoFilter  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IcoExcel   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="19"/></svg>
const IcoPdf     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 18h6M9 12h2"/></svg>
const IcoDown    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IcoRefresh = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IcoDoc     = () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>

// ── Helpers ───────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().split('T')[0]
const fmtHora = (s) => (s ? s.slice(0, 5) : '—')
function fmtFechaLarga(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  const t = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const EST = {
  PRESENTE:    { suf: 'pre', label: 'Presente'    },
  TARDANZA:    { suf: 'tar', label: 'Tardanza'    },
  AUSENTE:     { suf: 'aus', label: 'Ausente'     },
  JUSTIFICADO: { suf: 'jus', label: 'Justificado' },
}

function Spinner({ size = 18 }) {
  return <span className="rep-spinner" style={{ width: size, height: size }} />
}

// ════════════════════════════════════════════════════════════════════
export default function DirectorReportes() {
  const [fecha, setFecha]             = useState(hoy())
  const [grados, setGrados]           = useState([])
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [sesion, setSesion]       = useState(null)
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [bajando, setBajando]     = useState('')   // 'excel' | 'pdf'
  const [error, setError]         = useState('')

  // ── Cargas ─────────────────────────────────────────────────────
  const cargarGrados = useCallback(async () => {
    try {
      const { data } = await api.get('/colegios/grados/')
      setGrados(data.results ?? data)
    } catch { /* silencioso */ }
  }, [])

  const cargarPreview = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const { data } = await api.get('/asistencia/sesiones/', { params: { fecha } })
      const lista = data.results ?? data
      const s = Array.isArray(lista) ? (lista[0] ?? null) : null
      setSesion(s)
      if (s?.id) {
        const params = { sesion: s.id }
        if (filtroGrado)  params.grado_id = filtroGrado
        if (filtroEstado) params.estado   = filtroEstado
        const r = await api.get('/asistencia/registros/', { params })
        setRegistros(r.data.results ?? r.data)
      } else {
        setRegistros([])
      }
    } catch {
      setError('No se pudo cargar la vista previa.')
      setSesion(null); setRegistros([])
    } finally {
      setCargando(false)
    }
  }, [fecha, filtroGrado, filtroEstado])

  useEffect(() => { cargarGrados() }, [cargarGrados])
  useEffect(() => { cargarPreview() }, [cargarPreview])

  // ── Descarga (con token, como blob) ────────────────────────────
  const exportar = async (tipo) => {
    setBajando(tipo); setError('')
    try {
      const token = localStorage.getItem('access_token') || ''
      const qs = new URLSearchParams({ fecha })
      if (filtroGrado)  qs.set('grado_id', filtroGrado)
      if (filtroEstado) qs.set('estado', filtroEstado)
      const url = `${API_BASE}/asistencia/reportes/${tipo}/?${qs.toString()}`
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!resp.ok) throw new Error('export')
      const blob = await resp.blob()
      const obj  = URL.createObjectURL(blob)
      if (tipo === 'pdf') {
        window.open(obj, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = obj
        a.download = `asistencia_${fecha.replace(/-/g, '')}.csv`
        document.body.appendChild(a); a.click(); a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(obj), 8000)
    } catch {
      setError('No se pudo generar el reporte. Verifica los filtros e intenta de nuevo.')
    } finally {
      setBajando('')
    }
  }

  const stats = [
    { k: 'PRESENTE',    n: sesion?.total_presentes,    l: 'Presentes'    },
    { k: 'TARDANZA',    n: sesion?.total_tardanzas,    l: 'Tardanzas'    },
    { k: 'AUSENTE',     n: sesion?.total_ausentes,     l: 'Ausentes'     },
    { k: 'JUSTIFICADO', n: sesion?.total_justificados, l: 'Justificados' },
  ]
  const visibles = registros

  return (
    <div className="rep-root">

      {/* ── HERO / EXPORT ─────────────────────────────────────── */}
      <div className="rep-hero">
        <div className="rep-hero-grid" />
        <div className="rep-hero-glow" />

        <div className="rep-hero-main">
          <span className="rep-eyebrow">YachayQR · Documentos</span>
          <h1 className="rep-title">Repor<em>tes</em></h1>
          <p className="rep-lead">
            Exporta la asistencia de cualquier día en Excel o PDF, lista para
            imprimir o archivar.
          </p>

          <div className="rep-export-row">
            <button
              className="rep-export rep-export--excel"
              onClick={() => exportar('excel')}
              disabled={!!bajando}
            >
              <span className="rep-export-ico"><IcoExcel /></span>
              <span className="rep-export-txt">
                <strong>Exportar Excel</strong>
                <small>Hoja de cálculo (.csv · UTF-8)</small>
              </span>
              {bajando === 'excel' ? <Spinner size={17} /> : <IcoDown />}
            </button>

            <button
              className="rep-export rep-export--pdf"
              onClick={() => exportar('pdf')}
              disabled={!!bajando}
            >
              <span className="rep-export-ico"><IcoPdf /></span>
              <span className="rep-export-txt">
                <strong>Exportar PDF</strong>
                <small>Documento listo para imprimir</small>
              </span>
              {bajando === 'pdf' ? <Spinner size={17} /> : <IcoDown />}
            </button>
          </div>
        </div>

        <div className="rep-hero-doc"><IcoDoc /></div>
      </div>

      {error && (
        <div className="rep-error">
          ⚠ {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── FILTROS ───────────────────────────────────────────── */}
      <div className="rep-panel">
        <div className="rep-panel-head">
          <h2 className="rep-panel-title">
            <span className="rep-num">01</span> Filtros del reporte
          </h2>
          <button className="rep-ghost" onClick={cargarPreview} title="Actualizar">
            <IcoRefresh /> Actualizar
          </button>
        </div>

        <div className="rep-filtros">
          <div className="rep-field">
            <label><IcoCal /> Fecha</label>
            <input
              type="date" value={fecha} max={hoy()}
              onChange={e => setFecha(e.target.value)}
            />
          </div>
          <div className="rep-field">
            <label><IcoFilter /> Sección</label>
            <select value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)}>
              <option value="">Todas las secciones</option>
              {grados.map(g => (
                <option key={g.id} value={g.id}>
                  {g.grado}° "{g.nombre_seccion}" — {g.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria'}
                </option>
              ))}
            </select>
          </div>
          <div className="rep-field">
            <label><IcoFilter /> Estado</label>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="PRESENTE">Presente</option>
              <option value="TARDANZA">Tardanza</option>
              <option value="AUSENTE">Ausente</option>
              <option value="JUSTIFICADO">Justificado</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── VISTA PREVIA ──────────────────────────────────────── */}
      <div className="rep-panel">
        <div className="rep-panel-head">
          <h2 className="rep-panel-title">
            <span className="rep-num">02</span> Vista previa
          </h2>
          <span className="rep-fecha-chip">{fmtFechaLarga(fecha)}</span>
        </div>

        {cargando ? (
          <div className="rep-empty"><Spinner size={26} /><span>Cargando…</span></div>
        ) : !sesion ? (
          <div className="rep-empty rep-empty--box">
            <div className="rep-empty-ico"><IcoDoc /></div>
            <p className="rep-empty-t">Sin sesión el {fmtFechaLarga(fecha)}</p>
            <p className="rep-empty-d">
              No se registró asistencia ese día. El reporte se generará vacío.
            </p>
          </div>
        ) : (
          <>
            <div className="rep-stats">
              <div className="rep-stat rep-stat--total">
                <span className="rep-stat-n">{sesion.total_alumnos ?? 0}</span>
                <span className="rep-stat-l">Total alumnos</span>
              </div>
              {stats.map(s => (
                <div key={s.k} className={`rep-stat rep-stat--${EST[s.k].suf}`}>
                  <span className="rep-stat-n">{s.n ?? 0}</span>
                  <span className="rep-stat-l">{s.l}</span>
                </div>
              ))}
              <div className="rep-stat rep-stat--pct">
                <span className="rep-stat-n">{(sesion.porcentaje_asistencia ?? 0)}<i>%</i></span>
                <span className="rep-stat-l">Asistencia</span>
              </div>
            </div>

            <div className="rep-tabla-wrap">
              <table className="rep-tabla">
                <thead>
                  <tr>
                    <th>#</th><th>DNI</th><th>Alumno</th>
                    <th>Sección</th><th>Estado</th><th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr><td colSpan={6} className="rep-td-empty">
                      No hay registros con los filtros seleccionados.
                    </td></tr>
                  ) : visibles.map((r, i) => (
                    <tr key={r.id}>
                      <td className="rep-mono">{i + 1}</td>
                      <td className="rep-mono">{r.alumno?.dni ?? '—'}</td>
                      <td className="rep-nombre">{r.alumno?.nombre_completo ?? '—'}</td>
                      <td className="rep-soft">{r.alumno?.grado_label ?? '—'}</td>
                      <td>
                        <span className={`rep-badge rep-badge--${EST[r.estado]?.suf ?? ''}`}>
                          {EST[r.estado]?.label ?? r.estado}
                        </span>
                      </td>
                      <td className="rep-mono rep-soft">{fmtHora(r.hora_registro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibles.length > 0 && (
              <p className="rep-foot">
                {visibles.length} registro{visibles.length !== 1 ? 's' : ''} ·
                el archivo exportado incluye todas las columnas y el resumen.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
