import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../services/api'
import './EscanerScreen.css'

// ─── Íconos ───────────────────────────────────────────────────────
const IcoUser = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const IcoScan = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>
)

const IcoKeyboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
  </svg>
)

// ─── Config estados ───────────────────────────────────────────────
const ESTADO_CFG = {
  PRESENTE:    { label: 'Presente',    color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  TARDANZA:    { label: 'Tardanza',    color: '#d97706', bg: '#fef9c3', border: '#fde68a' },
  AUSENTE:     { label: 'Ausente',     color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  JUSTIFICADO: { label: 'Justificado', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
  YA_REGISTRADO: { label: 'Ya registrado', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
  ERROR:       { label: 'Error',       color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
}

const UMBRAL_MANUAL_MS = 1500  // si tarda más de esto → es teclado manual

// ─── Componente ───────────────────────────────────────────────────
export default function EscanerScreen() {
  const [sesion,        setSesion]        = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [codigo,        setCodigo]        = useState('')
  const [procesando,    setProcesando]    = useState(false)
  const [ultimoScan,    setUltimoScan]    = useState(null)   // último resultado
  const [historial,     setHistorial]     = useState([])     // lista local
  const [horaActual,    setHoraActual]    = useState('')

  const inputRef      = useRef(null)
  const inicioInputRef = useRef(null)  // timestamp primer carácter (anti-fraude)
  const procesandoRef  = useRef(false) // guard síncrono contra doble envío

  // ── Reloj ────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setHoraActual(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Cargar sesión ────────────────────────────────────────────
  const cargarSesion = useCallback(async () => {
    try {
      const { data } = await api.get('/asistencia/sesiones/hoy/')
      setSesion(data.sesion ?? null)
    } catch { /* silencioso */ }
    finally { setCargandoSesion(false) }
  }, [])

  useEffect(() => { cargarSesion() }, [cargarSesion])

  // Auto-refresh sesión cada 60s
  useEffect(() => {
    const id = setInterval(cargarSesion, 60_000)
    return () => clearInterval(id)
  }, [cargarSesion])

  // ── Auto-foco permanente ─────────────────────────────────────
  useEffect(() => {
    const refocus = () => {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
    document.addEventListener('click', refocus)
    inputRef.current?.focus()
    return () => document.removeEventListener('click', refocus)
  }, [])

  // ── Manejo del input ─────────────────────────────────────────
  const handleChange = (e) => {
    // El código es el DNI del alumno: solo dígitos, máximo 8.
    // Se descarta cualquier otro carácter (letras, símbolos) y el exceso.
    const val = e.target.value.replace(/\D/g, '').slice(0, 8)
    setCodigo(val)
    // Registrar tiempo del primer carácter
    if (val.length === 1) {
      inicioInputRef.current = Date.now()
    }
    if (val.length === 0) {
      inicioInputRef.current = null
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && codigo.trim()) {
      e.preventDefault()
      enviarCodigo(codigo.trim())
    }
  }

  // ── Enviar escaneo ───────────────────────────────────────────
  const enviarCodigo = async (cod) => {
    if (procesandoRef.current) return
    procesandoRef.current = true
    setProcesando(true)

    // Detectar si fue manual o lector
    const ahora = Date.now()
    const duracion = inicioInputRef.current ? (ahora - inicioInputRef.current) : 0
    const metodo = (duracion > UMBRAL_MANUAL_MS) ? 'MANUAL' : 'ESCANER'

    setCodigo('')
    inicioInputRef.current = null

    try {
      const { data } = await api.post('/asistencia/registros/escanear/', {
        codigo_barras: cod,
        metodo,
      })

      const resultado = {
        id:            Date.now(),
        alumno:        data.alumno,
        grado_label:   data.grado_label,
        foto_url:      data.foto_url,
        hora:          data.hora,
        estado:        data.ya_registrado ? 'YA_REGISTRADO' : data.estado,
        metodo,
        codigo:        cod,
      }

      setUltimoScan(resultado)
      setHistorial(prev => [resultado, ...prev].slice(0, 50))

      // Actualizar contadores de sesión si vienen en la respuesta
      if (data.sesion) {
        setSesion(prev => prev ? { ...prev, ...data.sesion } : data.sesion)
      } else {
        cargarSesion()
      }

    } catch (e) {
      const resultado = {
        id:        Date.now(),
        alumno:    null,
        error_msg: e.response?.data?.error || 'Error al registrar',
        hora:      new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        estado:    'ERROR',
        codigo:    cod,
      }
      setUltimoScan(resultado)
    } finally {
      procesandoRef.current = false
      setProcesando(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  const estadoSesion = cargandoSesion ? 'cargando'
    : !sesion                         ? 'sin-sesion'
    : sesion.estado === 'ABIERTA'     ? 'abierta'
    : 'cerrada'

  return (
    <div className="esc-root">

      {/* ── Topbar del escáner ────────────────────────────────── */}
      <div className="esc-topbar">
        <div className="esc-topbar-left">
          <div className={`esc-status-dot esc-status-dot--${estadoSesion}`} />
          <span className="esc-status-label">
            {estadoSesion === 'abierta'    && 'Sesión activa'}
            {estadoSesion === 'cerrada'    && 'Sesión cerrada'}
            {estadoSesion === 'sin-sesion' && 'Sin sesión — primer escaneo la abrirá'}
            {estadoSesion === 'cargando'   && 'Cargando...'}
          </span>
        </div>

        {sesion && (
          <div className="esc-stats">
            <div className="esc-stat esc-stat--presente">
              <span className="esc-stat-n">{sesion.total_presentes ?? 0}</span>
              <span className="esc-stat-l">Presentes</span>
            </div>
            <div className="esc-stat esc-stat--tardanza">
              <span className="esc-stat-n">{sesion.total_tardanzas ?? 0}</span>
              <span className="esc-stat-l">Tardanzas</span>
            </div>
            <div className="esc-stat esc-stat--ausente">
              <span className="esc-stat-n">{sesion.total_ausentes ?? 0}</span>
              <span className="esc-stat-l">Ausentes</span>
            </div>
            <div className="esc-stat esc-stat--total">
              <span className="esc-stat-n">{sesion.total_alumnos ?? 0}</span>
              <span className="esc-stat-l">Total</span>
            </div>
          </div>
        )}

        <div className="esc-hora">{horaActual}</div>
      </div>

      {/* ── Cuerpo principal ──────────────────────────────────── */}
      <div className="esc-body">

        {/* ─ Panel izquierdo: input + historial ─ */}
        <div className="esc-left">

          {/* Input de escaneo */}
          <div className="esc-input-zone">
            <div className="esc-input-label">
              <IcoScan /> Escanea o ingresa el código
            </div>
            <div className={`esc-input-wrap ${procesando ? 'esc-input-wrap--loading' : ''}`}>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={8}
                className="esc-input"
                value={codigo}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Listo para escanear..."
                autoComplete="off"
                spellCheck="false"
                disabled={estadoSesion === 'cerrada'}
              />
              {procesando && <div className="esc-input-spinner" />}
            </div>
            <div className="esc-input-hint">
              {estadoSesion === 'cerrada'
                ? '⛔ La sesión del día ya fue cerrada'
                : <>Apunta la lectora al código QR o de barras del carnet · <strong>Enter</strong> para confirmar</>
              }
            </div>
          </div>

          {/* Historial */}
          <div className="esc-historial">
            <div className="esc-historial-header">
              Historial de hoy
              <span className="esc-historial-count">{historial.length}</span>
            </div>
            {historial.length === 0 ? (
              <div className="esc-historial-empty">
                Aún no hay registros en esta sesión
              </div>
            ) : (
              <div className="esc-historial-lista">
                {historial.map((h, i) => {
                  const cfg = ESTADO_CFG[h.estado] ?? ESTADO_CFG.ERROR
                  return (
                    <div key={h.id} className={`esc-hist-item ${i === 0 ? 'esc-hist-item--nuevo' : ''}`}>
                      <div className="esc-hist-foto">
                        {h.estado === 'ERROR'
                          ? <div className="esc-hist-avatar esc-hist-avatar--error">!</div>
                          : h.foto_url
                            ? <img src={h.foto_url} alt="" />
                            : <div className="esc-hist-avatar">{h.alumno?.charAt(0) ?? '?'}</div>
                        }
                      </div>
                      <div className="esc-hist-info">
                        {h.estado === 'ERROR'
                          ? <span className="esc-hist-nombre esc-hist-nombre--error">{h.error_msg}</span>
                          : <>
                              <span className="esc-hist-nombre">{h.alumno}</span>
                              {h.grado_label && <span className="esc-hist-grado">{h.grado_label}</span>}
                            </>
                        }
                      </div>
                      <div className="esc-hist-right">
                        <span className="esc-hist-hora">{h.hora}</span>
                        <span className="esc-hist-badge" style={{ color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                        {h.metodo === 'MANUAL' && (
                          <span className="esc-hist-manual" title="Ingreso manual (teclado)">
                            <IcoKeyboard />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─ Panel derecho: último registro ─ */}
        <div className="esc-right">
          {ultimoScan ? (
            <UltimoRegistro scan={ultimoScan} />
          ) : (
            <div className="esc-right-empty">
              <div className="esc-right-empty-icon"><IcoScan /></div>
              <p>Esperando escaneo</p>
              <span>El resultado aparecerá aquí</span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Card del último registro ─────────────────────────────────────
function UltimoRegistro({ scan }) {
  const cfg = ESTADO_CFG[scan.estado] ?? ESTADO_CFG.ERROR

  return (
    <div className="esc-ultimo" style={{ '--est-color': cfg.color, '--est-bg': cfg.bg, '--est-border': cfg.border }}>
      <div className="esc-ultimo-foto">
        {scan.foto_url
          ? <img src={scan.foto_url} alt={scan.alumno} />
          : <div className="esc-ultimo-avatar"><IcoUser /></div>
        }
      </div>

      <div className="esc-ultimo-info">
        <h2 className="esc-ultimo-nombre">
          {scan.estado === 'ERROR' ? scan.error_msg : scan.alumno}
        </h2>
        {scan.grado_label && scan.estado !== 'ERROR' && (
          <p className="esc-ultimo-grado">{scan.grado_label}</p>
        )}
      </div>

      <div className="esc-ultimo-badge">
        {cfg.label}
      </div>

      <div className="esc-ultimo-hora">
        {scan.hora}
      </div>

      {scan.metodo === 'MANUAL' && (
        <div className="esc-ultimo-manual">
          <IcoKeyboard /> Ingreso manual detectado
        </div>
      )}
    </div>
  )
}
