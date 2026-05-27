import { useState, useEffect, useCallback } from 'react'
import { usePlataformaAuth } from '../../context/PlataformaAuthContext'
import apiPlataforma from '../../services/apiPlataforma'
import './Plataforma.css'

const IcoPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

// Normaliza a un subdominio válido: minúsculas, [a-z0-9], inicia con letra.
const normSub = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^[0-9]+/, '').slice(0, 31)

const FORM0 = {
  nombre: '', subdominio: '', email_contacto: '', telefono: '',
  admin_password: '', whatsapp_activo: false,
}

export default function PlataformaColegios() {
  const { duenio, logout } = usePlataformaAuth()
  const [lista, setLista]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(FORM0)
  const [error, setError]       = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await apiPlataforma.get('/plataforma/colegios/')
      setLista(data.results ?? data)
    } catch {
      setError('No se pudieron cargar los colegios.')
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrir = () => { setForm(FORM0); setError(''); setExito(null); setModal(true) }

  const crear = async (e) => {
    e.preventDefault()
    setGuardando(true); setError('')
    try {
      const { data } = await apiPlataforma.post('/plataforma/colegios/', {
        ...form, subdominio: normSub(form.subdominio),
      })
      setExito({ ...data, password: form.admin_password })
      await cargar()
    } catch (err) {
      const d = err.response?.data
      setError(
        d?.subdominio?.[0] || d?.admin_password?.[0] || d?.email_contacto?.[0] ||
        d?.detail || 'No se pudo registrar el colegio.'
      )
    } finally { setGuardando(false) }
  }

  const toggle = async (c) => {
    const accion = c.activo ? 'suspender' : 'reactivar'
    if (!confirm(`¿Seguro que quieres ${accion} a "${c.nombre}"?`)) return
    try {
      await apiPlataforma.post(`/plataforma/colegios/${c.id}/toggle-activo/`)
      cargar()
    } catch {
      setError(`No se pudo ${accion} el colegio.`)
    }
  }

  const toggleWhatsapp = async (c) => {
    const accion = c.whatsapp_activo ? 'desactivar' : 'activar'
    if (!confirm(`¿${accion === 'activar' ? 'Activar' : 'Desactivar'} las notificaciones WhatsApp de "${c.nombre}"?`)) return
    try {
      await apiPlataforma.post(`/plataforma/colegios/${c.id}/toggle-whatsapp/`)
      cargar()
    } catch {
      setError(`No se pudo ${accion} WhatsApp del colegio.`)
    }
  }

  const subPreview = normSub(form.subdominio)

  return (
    <div className="plat plat-shell">
      <header className="plat-top">
        <div className="plat-brand">
          <span className="plat-brand-name">Yachay<em>QR</em></span>
          <span className="plat-brand-tag">Plataforma</span>
        </div>
        <div className="plat-top-right">
          <span className="plat-user">{duenio?.nombre}</span>
          <button className="plat-logout" onClick={logout}>Salir</button>
        </div>
      </header>

      <main className="plat-main">
        <div className="plat-head">
          <div>
            <h1 className="plat-h1">Colegios <em>registrados</em></h1>
            <p className="plat-h1-sub">Alta, suspensión y acceso de cada institución.</p>
          </div>
          <button className="plat-cta" onClick={abrir}><IcoPlus /> Registrar colegio</button>
        </div>

        {error && !modal && <div className="plat-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        <div className="plat-table">
          <div className="plat-row-head">
            <span>Colegio</span>
            <span className="plat-col-dom">Dominio</span>
            <span className="plat-col-fecha">Schema</span>
            <span>Estado</span>
            <span />
          </div>

          {cargando ? (
            <div className="plat-loading">Cargando…</div>
          ) : lista.length === 0 ? (
            <div className="plat-empty">Aún no hay colegios. Registra el primero.</div>
          ) : lista.map((c) => (
            <div className="plat-row" key={c.id}>
              <span className="plat-cole-nombre">{c.nombre}</span>
              <span className="plat-dom plat-col-dom">
                {c.url_acceso
                  ? <a href={c.url_acceso} target="_blank" rel="noreferrer"
                       style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {c.dominio}
                    </a>
                  : c.dominio}
              </span>
              <span className="plat-col-fecha"><span className="plat-chip">{c.schema_name}</span></span>
              <span className={`plat-estado plat-estado--${c.activo ? 'ok' : 'off'}`}>
                <span className="plat-dot" />{c.activo ? 'Activo' : 'Suspendido'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  className={`plat-toggle ${c.activo ? '' : 'plat-toggle--reactivar'}`}
                  onClick={() => toggle(c)}>
                  {c.activo ? 'Suspender' : 'Reactivar'}
                </button>
                <button
                  className="plat-toggle"
                  onClick={() => toggleWhatsapp(c)}
                  title="Plan Premium: notificaciones por WhatsApp"
                  style={c.whatsapp_activo
                    ? { color: '#0f2a4c', borderColor: '#fbbf24', fontWeight: 700 }
                    : undefined}>
                  WhatsApp {c.whatsapp_activo ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {modal && (
        <div className="plat-modal-bg" onClick={(e) => e.target === e.currentTarget && !guardando && setModal(false)}>
          <div className="plat-modal">
            {exito ? (
              <>
                <h2 className="plat-modal-h">Colegio creado</h2>
                <p className="plat-modal-sub">{exito.mensaje}</p>
                <div className="plat-ok">
                  <p className="plat-ok-t">Datos de acceso del Director</p>
                  <div className="plat-ok-row">
                    <span>URL</span>
                    <b>
                      <a href={exito.acceso?.url} target="_blank" rel="noreferrer"
                         style={{ color: 'inherit' }}>
                        {exito.acceso?.url}
                      </a>
                    </b>
                  </div>
                  <div className="plat-ok-row"><span>Usuario</span><b>{exito.acceso?.usuario}</b></div>
                  <div className="plat-ok-row"><span>Contraseña</span><b>{exito.password}</b></div>
                </div>
                <p className="plat-hint" style={{ margin: '12px 0 18px' }}>
                  Comparte estos datos con el colegio. Recomiéndale cambiar la contraseña.
                </p>
                <div className="plat-modal-actions">
                  <button className="plat-save" onClick={() => setModal(false)}>Entendido</button>
                </div>
              </>
            ) : (
              <form onSubmit={crear}>
                <h2 className="plat-modal-h">Registrar colegio</h2>
                <p className="plat-modal-sub">Se crea su espacio aislado y el usuario Director.</p>

                {error && <div className="plat-error">⚠ {error}</div>}

                <div className="plat-mf">
                  <label>Nombre del colegio</label>
                  <input value={form.nombre} required disabled={guardando}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="IESTA - Coasa" />
                </div>
                <div className="plat-mf">
                  <label>Subdominio</label>
                  <input value={form.subdominio} required disabled={guardando}
                    onChange={e => setForm(f => ({ ...f, subdominio: e.target.value }))}
                    placeholder="iestacoasa" />
                  <span className="plat-hint">
                    Acceso en → <b>{'http://' + (subPreview || 'subdominio') + '.localhost:5173/login'}</b>
                    {' '}· 3-31, minúsculas/números, inicia con letra
                  </span>
                </div>
                <div className="plat-mf">
                  <label>Email de contacto</label>
                  <input type="email" value={form.email_contacto} required disabled={guardando}
                    onChange={e => setForm(f => ({ ...f, email_contacto: e.target.value }))}
                    placeholder="contacto@colegio.edu.pe" />
                </div>
                <div className="plat-mf">
                  <label>Teléfono (opcional)</label>
                  <input value={form.telefono} disabled={guardando}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    placeholder="+51 9..." />
                </div>
                <div className="plat-mf">
                  <label>Contraseña del Director</label>
                  <input type="password" value={form.admin_password} required disabled={guardando}
                    minLength={8}
                    onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))}
                    placeholder="mínimo 8 caracteres" />
                  <span className="plat-hint">No numérica, no común, no parecida al usuario.</span>
                </div>

                <div className="plat-mf">
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', textTransform: 'none',
                    letterSpacing: 0, fontSize: 13, fontWeight: 500,
                  }}>
                    <input type="checkbox" checked={form.whatsapp_activo} disabled={guardando}
                      onChange={e => setForm(f => ({ ...f, whatsapp_activo: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    ¿Activar envío de notificaciones WhatsApp? (Plan Premium)
                  </label>
                </div>

                <div className="plat-modal-actions">
                  <button type="button" className="plat-cancel" disabled={guardando}
                    onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="plat-save" disabled={guardando}>
                    {guardando ? <span className="plat-spin" /> : 'Crear colegio'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
