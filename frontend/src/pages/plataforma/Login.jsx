import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { usePlataformaAuth } from '../../context/PlataformaAuthContext'
import './Plataforma.css'

const IcoArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

export default function PlataformaLogin() {
  const [form, setForm]   = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [tsOk, setTsOk]   = useState(false)
  const tsToken           = useRef(null)
  const { login }         = usePlataformaAuth()
  const navigate          = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    if (!tsOk) { setError('Completa la verificación de seguridad.'); return }
    setCargando(true); setError('')
    try {
      await login(form.username, form.password, tsToken.current)
      navigate('/plataforma/colegios')
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Credenciales inválidas o sin acceso de plataforma.'
      )
    } finally { setCargando(false) }
  }

  return (
    <div className="plat plat-login">
      <form className="plat-card" onSubmit={submit}>
        <div className="plat-eyebrow">YachayQR · Plataforma</div>
        <h1 className="plat-title">Panel del <em>Administrador</em></h1>
        <p className="plat-sub">Acceso exclusivo del dueño del sistema.</p>

        {error && <div className="plat-error">⚠ {error}</div>}

        <div className="plat-field">
          <label htmlFor="u">Usuario</label>
          <input id="u" className="plat-input" autoComplete="username"
            value={form.username} disabled={cargando}
            onChange={e => { setForm({ ...form, username: e.target.value }); setError('') }}
            placeholder="superusuario" required />
        </div>

        <div className="plat-field">
          <label htmlFor="p">Contraseña</label>
          <input id="p" type="password" className="plat-input"
            autoComplete="current-password" value={form.password} disabled={cargando}
            onChange={e => { setForm({ ...form, password: e.target.value }); setError('') }}
            placeholder="••••••••" required />
        </div>

        <div className="plat-turnstile">
          <Turnstile
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
            onSuccess={(t) => { tsToken.current = t; setTsOk(true) }}
            onExpire={() => setTsOk(false)}
            onError={() => setTsOk(false)}
            options={{ theme: 'dark', language: 'es' }}
          />
        </div>

        <button className="plat-btn" disabled={cargando || !tsOk}>
          {cargando ? <span className="plat-spin" /> : <>Ingresar <IcoArrow /></>}
        </button>

        <p className="plat-foot">© {new Date().getFullYear()} YachayQR · Plataforma</p>
      </form>
    </div>
  )
}
