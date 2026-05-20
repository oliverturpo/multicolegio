import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import './Usuarios.css'

// ── Íconos ───────────────────────────────────────────────────────
const IcoPlus    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoEdit    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoClose   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoCheck   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoEye     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const IcoEyeOff  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const IcoRefresh = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IcoShield  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>

// ── Configuración de roles ────────────────────────────────────────
const ROLES = [
  { value: 'DIRECTOR',  label: 'Director',  color: '#7c3aed', bg: '#ede9fe' },
  { value: 'AUXILIAR',  label: 'Auxiliar',  color: '#0369a1', bg: '#e0f2fe' },
  { value: 'PSICOLOGO', label: 'Psicólogo', color: '#0f766e', bg: '#ccfbf1' },
  { value: 'ESCANER',   label: 'Escáner',   color: '#b45309', bg: '#fef3c7' },
]

const ROL_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]))

const FORM_INICIAL = {
  first_name: '', last_name: '', username: '',
  email: '', rol: '', password: '', confirmar: '',
}

// ── Helpers ───────────────────────────────────────────────────────
function BadgeRol({ rol }) {
  const cfg = ROL_MAP[rol] ?? { label: rol, color: '#64748b', bg: '#f1f5f9' }
  return (
    <span className="usr-badge-rol" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  )
}

function BadgeActivo({ activo }) {
  return activo
    ? <span className="usr-badge" style={{ color: '#16a34a', background: '#dcfce7' }}>Activo</span>
    : <span className="usr-badge" style={{ color: '#dc2626', background: '#fee2e2' }}>Inactivo</span>
}

function Spinner({ size = 18, color = 'var(--navy)' }) {
  return <div className="usr-spinner" style={{ width: size, height: size, borderTopColor: color }} />
}

function Avatar({ nombre, rol }) {
  const cfg = ROL_MAP[rol] ?? { color: '#64748b', bg: '#f1f5f9' }
  const inicial = (nombre || '?').charAt(0).toUpperCase()
  return (
    <div className="usr-avatar" style={{ background: cfg.bg, color: cfg.color }}>
      {inicial}
    </div>
  )
}

// ── Campo con ojo para contraseña ─────────────────────────────────
function CampoPassword({ label, value, onChange, error, placeholder, requerido = false }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="fg">
      <label>{label} {requerido && <span className="req">*</span>}</label>
      <div className="pwd-wrap">
        <input
          type={ver ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={error ? 'err' : ''}
          autoComplete="new-password"
        />
        <button type="button" className="pwd-eye" onClick={() => setVer(v => !v)} tabIndex={-1}>
          {ver ? <IcoEyeOff /> : <IcoEye />}
        </button>
      </div>
      {error && <span className="fg-err">{error}</span>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
export default function DirectorUsuarios() {
  const { usuario: usuarioActual } = useAuth()

  const [usuarios,  setUsuarios]  = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [filtroRol, setFiltroRol] = useState('')

  const [panelAbierto, setPanelAbierto] = useState(false)
  const [modoEdicion,  setModoEdicion]  = useState(false)
  const [usuarioEdit,  setUsuarioEdit]  = useState(null)
  const [guardando,    setGuardando]    = useState(false)
  const [toggling,     setToggling]     = useState(null) // id del que se está toggling

  const [form,    setForm]    = useState(FORM_INICIAL)
  const [errores, setErrores] = useState({})
  const [exito,   setExito]   = useState('')
  const [error,   setError]   = useState('')

  // ── Carga ──────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = filtroRol ? { rol: filtroRol } : {}
      const { data } = await api.get('/usuarios/', { params })
      setUsuarios(data.results ?? data)
    } catch {
      setError('No se pudo cargar la lista de usuarios.')
    } finally {
      setCargando(false)
    }
  }, [filtroRol])

  useEffect(() => { cargar() }, [cargar])

  // ── Panel ──────────────────────────────────────────────────────
  const resetPanel = () => {
    setForm(FORM_INICIAL); setErrores({}); setExito(''); setError('')
  }

  const abrirNuevo = () => {
    setModoEdicion(false); setUsuarioEdit(null)
    resetPanel(); setPanelAbierto(true)
  }

  const abrirEdicion = (u) => {
    setModoEdicion(true); setUsuarioEdit(u)
    setForm({
      first_name: u.nombre_completo.split(' ')[0] ?? '',
      last_name:  u.nombre_completo.split(' ').slice(1).join(' ') ?? '',
      username:   u.username,
      email:      u.email ?? '',
      rol:        u.rol,
      password:   '',
      confirmar:  '',
    })
    setErrores({}); setExito(''); setError('')
    setPanelAbierto(true)
  }

  const cerrarPanel = () => {
    setPanelAbierto(false)
    setTimeout(resetPanel, 250)
  }

  // ── Validar ────────────────────────────────────────────────────
  const validar = () => {
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'Obligatorio'
    if (!form.last_name.trim())  errs.last_name  = 'Obligatorio'
    if (!form.rol)               errs.rol        = 'Selecciona un rol'
    if (!modoEdicion) {
      if (!form.username.trim()) errs.username = 'Obligatorio'
      if (!form.password)        errs.password = 'Obligatorio'
    }
    if (form.password && form.password.length < 8)   errs.password  = 'Mínimo 8 caracteres'
    if (form.password && form.password !== form.confirmar) errs.confirmar = 'Las contraseñas no coinciden'
    return errs
  }

  // ── Guardar ────────────────────────────────────────────────────
  const handleGuardar = async (e) => {
    e.preventDefault()
    setError(''); setExito('')
    const errs = validar()
    if (Object.keys(errs).length) { setErrores(errs); return }

    setGuardando(true)
    try {
      if (modoEdicion) {
        const payload = {
          first_name: form.first_name,
          last_name:  form.last_name,
          email:      form.email,
          rol:        form.rol,
        }
        if (form.password) payload.password = form.password
        await api.patch(`/usuarios/${usuarioEdit.id}/`, payload)
        setExito('Usuario actualizado correctamente.')
      } else {
        await api.post('/usuarios/', {
          username:   form.username,
          password:   form.password,
          first_name: form.first_name,
          last_name:  form.last_name,
          email:      form.email,
          rol:        form.rol,
        })
        setExito('Usuario creado correctamente.')
      }
      await cargar()
      setTimeout(cerrarPanel, 1400)
    } catch (err) {
      const d = err.response?.data
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        const msgs = {}
        Object.entries(d).forEach(([k, v]) => { msgs[k] = Array.isArray(v) ? v[0] : String(v) })
        setErrores(msgs)
      }
      setError('Corrige los errores antes de guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Toggle activo ──────────────────────────────────────────────
  const handleToggle = async (u) => {
    const accion = u.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${u.nombre_completo}?`)) return
    setToggling(u.id)
    try {
      await api.post(`/usuarios/${u.id}/toggle-activo/`)
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar el estado.')
    } finally {
      setToggling(null)
    }
  }

  // ── Espropia cuenta ────────────────────────────────────────────
  const esPropiacuenta = (u) => u.username === usuarioActual?.username

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="usr-root">

      {/* CABECERA */}
      <div className="usr-header">
        <div>
          <h1 className="usr-title">Usuarios del sistema</h1>
          <p className="usr-subtitle">
            {cargando ? 'Cargando…' : `${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrado${usuarios.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="usr-btn-primary" onClick={abrirNuevo}>
          <IcoPlus /> Nuevo usuario
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="usr-toolbar">
        <div className="usr-roles-filter">
          <button
            className={`usr-rol-pill ${!filtroRol ? 'active' : ''}`}
            onClick={() => setFiltroRol('')}
          >
            Todos
          </button>
          {ROLES.map(r => (
            <button
              key={r.value}
              className={`usr-rol-pill ${filtroRol === r.value ? 'active' : ''}`}
              style={filtroRol === r.value ? { background: r.bg, color: r.color, borderColor: r.color } : {}}
              onClick={() => setFiltroRol(filtroRol === r.value ? '' : r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button className="usr-btn-ghost" onClick={cargar} title="Actualizar"><IcoRefresh /></button>
      </div>

      {/* ERROR */}
      {error && !panelAbierto && (
        <div className="usr-error-banner">⚠ {error}</div>
      )}

      {/* GRID DE CARDS */}
      {cargando ? (
        <div className="usr-loading"><Spinner size={28} /><span>Cargando usuarios…</span></div>
      ) : usuarios.length === 0 ? (
        <div className="usr-empty">
          <div className="usr-empty-ico"><IcoShield /></div>
          <p>No hay usuarios{filtroRol ? ` con rol ${ROL_MAP[filtroRol]?.label}` : ''}.</p>
          <button className="usr-btn-primary" onClick={abrirNuevo}><IcoPlus /> Crear primero</button>
        </div>
      ) : (
        <div className="usr-grid">
          {usuarios.map(u => (
            <div key={u.id} className={`usr-card ${!u.activo ? 'usr-card--inactivo' : ''} ${esPropiacuenta(u) ? 'usr-card--yo' : ''}`}>

              <div className="usr-card-top">
                <Avatar nombre={u.nombre_completo} rol={u.rol} />
                <div className="usr-card-badges">
                  <BadgeRol rol={u.rol} />
                  {esPropiacuenta(u) && <span className="usr-badge-yo">Tú</span>}
                </div>
              </div>

              <div className="usr-card-info">
                <p className="usr-card-nombre">{u.nombre_completo}</p>
                <p className="usr-card-username">@{u.username}</p>
                {u.email && <p className="usr-card-email">{u.email}</p>}
              </div>

              <div className="usr-card-footer">
                <BadgeActivo activo={u.activo} />
                <div className="usr-card-acciones">
                  <button
                    className="usr-ico-btn usr-ico-btn--edit"
                    onClick={() => abrirEdicion(u)}
                    title="Editar"
                  >
                    <IcoEdit />
                  </button>
                  {!esPropiacuenta(u) && (
                    <button
                      className={`usr-toggle-btn ${u.activo ? 'usr-toggle-btn--off' : 'usr-toggle-btn--on'}`}
                      onClick={() => handleToggle(u)}
                      disabled={toggling === u.id}
                      title={u.activo ? 'Desactivar' : 'Activar'}
                    >
                      {toggling === u.id
                        ? <Spinner size={13} color={u.activo ? '#dc2626' : '#16a34a'} />
                        : u.activo ? 'Desactivar' : 'Activar'
                      }
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PANEL LATERAL
      ═══════════════════════════════════════════════════════════ */}
      {panelAbierto && (
        <div className="usr-overlay" onClick={e => e.target === e.currentTarget && cerrarPanel()}>
          <div className="usr-panel">

            <div className="usr-panel-header">
              <h2 className="usr-panel-title">
                {modoEdicion ? 'Editar usuario' : 'Nuevo usuario'}
              </h2>
              <button className="usr-panel-close" onClick={cerrarPanel}><IcoClose /></button>
            </div>

            <div className="usr-panel-body">
              <form onSubmit={handleGuardar} noValidate>

                {exito && <div className="usr-exito"><IcoCheck /> {exito}</div>}
                {error && <div className="usr-error-inline">⚠ {error}</div>}

                {/* Nombres */}
                <div className="form-section">
                  <div className="form-section-title">Datos personales</div>

                  <div className="fg-row">
                    <div className="fg">
                      <label>Nombres <span className="req">*</span></label>
                      <input type="text"
                        value={form.first_name}
                        onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                        placeholder="Juan"
                        className={errores.first_name ? 'err' : ''}
                      />
                      {errores.first_name && <span className="fg-err">{errores.first_name}</span>}
                    </div>
                    <div className="fg">
                      <label>Apellidos <span className="req">*</span></label>
                      <input type="text"
                        value={form.last_name}
                        onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                        placeholder="Pérez García"
                        className={errores.last_name ? 'err' : ''}
                      />
                      {errores.last_name && <span className="fg-err">{errores.last_name}</span>}
                    </div>
                  </div>

                  <div className="fg">
                    <label>Correo electrónico</label>
                    <input type="email"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="juan@colegio.edu.pe"
                      className={errores.email ? 'err' : ''}
                    />
                    {errores.email && <span className="fg-err">{errores.email}</span>}
                  </div>
                </div>

                {/* Acceso */}
                <div className="form-section">
                  <div className="form-section-title">Acceso al sistema</div>

                  {/* Username solo en creación */}
                  {!modoEdicion && (
                    <div className="fg">
                      <label>Usuario <span className="req">*</span></label>
                      <input type="text"
                        value={form.username}
                        onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                        placeholder="juan.perez"
                        autoComplete="off"
                        className={errores.username ? 'err' : ''}
                      />
                      {errores.username && <span className="fg-err">{errores.username}</span>}
                      <span className="fg-hint">Solo letras, números y puntos. Sin espacios.</span>
                    </div>
                  )}

                  {/* Rol */}
                  <div className="fg">
                    <label>Rol <span className="req">*</span></label>
                    <div className="rol-selector">
                      {ROLES.map(r => (
                        <button
                          key={r.value}
                          type="button"
                          className={`rol-option ${form.rol === r.value ? 'active' : ''}`}
                          style={form.rol === r.value ? { background: r.bg, color: r.color, borderColor: r.color } : {}}
                          onClick={() => setForm(p => ({ ...p, rol: r.value }))}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    {errores.rol && <span className="fg-err">{errores.rol}</span>}
                    {form.rol && <span className="fg-hint">{ROL_DESC[form.rol]}</span>}
                  </div>

                  {/* Contraseña */}
                  <CampoPassword
                    label={modoEdicion ? 'Nueva contraseña' : 'Contraseña'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    error={errores.password}
                    placeholder={modoEdicion ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                    requerido={!modoEdicion}
                  />

                  {form.password && (
                    <CampoPassword
                      label="Confirmar contraseña"
                      value={form.confirmar}
                      onChange={e => setForm(p => ({ ...p, confirmar: e.target.value }))}
                      error={errores.confirmar}
                      placeholder="Repite la contraseña"
                      requerido
                    />
                  )}
                </div>

                <div className="form-actions">
                  <button type="submit" className="usr-btn-primary" disabled={guardando}>
                    {guardando
                      ? <><Spinner size={16} color="#fff" /> Guardando…</>
                      : modoEdicion ? 'Guardar cambios' : 'Crear usuario'
                    }
                  </button>
                  <button type="button" className="usr-btn-ghost" onClick={cerrarPanel}>
                    Cancelar
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Descripción de cada rol (para el hint)
const ROL_DESC = {
  DIRECTOR:  'Acceso total: dashboard, escáner, alumnos, reportes y usuarios.',
  AUXILIAR:  'Acceso al escáner, lista de asistencias y consulta de alumnos.',
  PSICOLOGO: 'Gestiona justificaciones y consulta la lista de alumnos.',
  ESCANER:   'Solo puede usar la pantalla de escáner (modo kiosco).',
}
