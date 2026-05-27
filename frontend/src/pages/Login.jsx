import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import './Login.css'

const RUTA_POR_ROL = {
  DIRECTOR:  '/director/dashboard',
  AUXILIAR:  '/auxiliar/escaner',
  PSICOLOGO: '/psicologo/justificaciones',
  ESCANER:   '/escaner',
}

// ── Íconos SVG inline ────────────────────────────────────────────
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const IconEye = ({ off }) => off ? (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const IconArrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

// ── Patrón andino en SVG ─────────────────────────────────────────
const AndeanPattern = () => (
  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}
    viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id="andean" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M0 60 L20 60 L20 40 L40 40 L40 20 L60 20 L60 0"
          stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
        <path d="M80 60 L60 60 L60 40 L40 40"
          stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
        <path d="M40 65 L50 75 L40 85 L30 75 Z"
          stroke="#fbbf24" strokeWidth="1" fill="none"/>
      </pattern>
    </defs>
    <rect width="400" height="600" fill="url(#andean)"/>
  </svg>
)

// ── Ícono QR decorativo ──────────────────────────────────────────
const QRDecoration = () => (
  <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="#1e3a5f" strokeWidth="1.8"/>
    <rect x="4" y="4" width="6" height="6" rx="0.5" fill="#1e3a5f"/>
    <rect x="16" y="2" width="10" height="10" rx="1.5" stroke="#1e3a5f" strokeWidth="1.8"/>
    <rect x="18" y="4" width="6" height="6" rx="0.5" fill="#1e3a5f"/>
    <rect x="2" y="16" width="10" height="10" rx="1.5" stroke="#1e3a5f" strokeWidth="1.8"/>
    <rect x="4" y="18" width="6" height="6" rx="0.5" fill="#1e3a5f"/>
    <rect x="16" y="16" width="3" height="3" fill="#1e3a5f"/>
    <rect x="21" y="16" width="3" height="3" fill="#1e3a5f"/>
    <rect x="16" y="21" width="3" height="3" fill="#1e3a5f"/>
    <rect x="21" y="21" width="3" height="3" fill="#1e3a5f"/>
  </svg>
)

// ── Pantalla: colegio (subdominio) no registrado ─────────────────
function ColegioNoEncontrado() {
  return (
    <div className="login-bg" style={{
      background: 'linear-gradient(160deg, #1e3a5f 0%, #0f2a4c 100%)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%',
        padding: '44px 40px', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,.35)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, marginBottom: 28,
        }}>
          <QRDecoration />
          <span style={{ fontSize: 22, fontWeight: 800, color: '#0f2a4c' }}>
            Yachay<span style={{ color: '#fbbf24' }}>QR</span>
          </span>
        </div>

        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
          display: 'grid', placeItems: 'center',
          background: '#fef3c7', color: '#f59e0b',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 700, color: '#0f2a4c', margin: '0 0 10px',
        }}>
          Colegio no encontrado
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
          El colegio <b style={{ color: '#0f2a4c' }}>{window.location.hostname}</b> no
          está registrado en YachayQR. Verifica la dirección o contacta al
          administrador de tu institución.
        </p>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────
export default function Login() {
  const [form, setForm]               = useState({ username: '', password: '' })
  const [showPwd, setShowPwd]         = useState(false)
  const [error, setError]             = useState('')
  const [cargando, setCargando]       = useState(false)
  const [turnstileOk, setTurnstileOk] = useState(false)
  // 'verificando' | 'ok' | 'no_encontrado' — existencia del colegio del subdominio
  const [tenantEstado, setTenantEstado] = useState('verificando')
  const turnstileToken                = useRef(null)
  const { login }                     = useAuth()
  const navigate                      = useNavigate()

  // Al cargar, verifica que el subdominio corresponda a un colegio registrado.
  useEffect(() => {
    api.get('/auth/verify-tenant/')
      .then(() => setTenantEstado('ok'))
      .catch((err) => {
        // 404 = subdominio sin colegio (o schema public). Cualquier otro
        // error (red, 500) no bloquea el login.
        setTenantEstado(err.response?.status === 404 ? 'no_encontrado' : 'ok')
      })
  }, [])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!turnstileOk) { setError('Completa la verificación de seguridad.'); return }
    setCargando(true)
    setError('')
    try {
      const rol = await login(form.username, form.password, turnstileToken.current)
      navigate(RUTA_POR_ROL[rol] || '/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Usuario o contraseña incorrectos.')
    } finally {
      setCargando(false)
    }
  }

  if (tenantEstado === 'no_encontrado') return <ColegioNoEncontrado />
  if (tenantEstado === 'verificando') {
    return (
      <div className="login-bg" style={{
        background: 'linear-gradient(160deg, #1e3a5f 0%, #0f2a4c 100%)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="btn-spinner" />
      </div>
    )
  }

  return (
    <div className="login-bg">
      <div className="login-card">

        {/* ── Panel izquierdo: marca ─────────────────────────── */}
        <div className="brand-panel">
          <AndeanPattern />

          {/* Sol decorativo */}
          <svg className="sol-deco" width="240" height="240" viewBox="0 0 100 100">
            <g stroke="#fbbf24" strokeWidth="1.2" fill="none">
              <circle cx="50" cy="50" r="18"/>
              {Array.from({ length: 16 }).map((_, i) => {
                const a = (i * Math.PI * 2) / 16
                return <line key={i}
                  x1={50 + Math.cos(a) * 22} y1={50 + Math.sin(a) * 22}
                  x2={50 + Math.cos(a) * 32} y2={50 + Math.sin(a) * 32}/>
              })}
            </g>
          </svg>

          {/* Logo */}
          <div className="brand-logo">
            <div className="brand-logo-icon"><QRDecoration /></div>
            <div>
              <div className="brand-name">
                Yachay<span className="brand-accent">QR</span>
              </div>
              <div className="brand-tagline">Sistema escolar</div>
            </div>
          </div>

          {/* Texto central */}
          <div className="brand-copy">
            <div className="brand-label">◆ Yachay · saber</div>
            <h2 className="brand-headline">
              Asistencia escolar,<br />simple como escanear.
            </h2>
            <p className="brand-desc">
              Control en tiempo real de entradas, salidas y justificaciones
              para toda la comunidad educativa.
            </p>
          </div>

        </div>

        {/* ── Panel derecho: formulario ──────────────────────── */}
        <div className="form-panel">
          <div className="form-header">
            <h1 className="form-title">Bienvenido de nuevo</h1>
            <p className="form-subtitle">Ingresa con tus credenciales institucionales.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">

            {/* Usuario */}
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <div className="input-wrap">
                <span className="icon-left"><IconUser /></span>
                <input
                  id="username" name="username" type="text"
                  autoComplete="username" placeholder="usuario.apellido"
                  value={form.username} onChange={handleChange}
                  required disabled={cargando}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="input-wrap">
                <span className="icon-left"><IconLock /></span>
                <input
                  id="password" name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="••••••••"
                  value={form.password} onChange={handleChange}
                  required disabled={cargando}
                />
                <button type="button" className="icon-right"
                  onClick={() => setShowPwd(p => !p)} tabIndex={-1}>
                  <IconEye off={showPwd} />
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile */}
            <div className="turnstile-wrap">
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                onSuccess={(token) => { turnstileToken.current = token; setTurnstileOk(true) }}
                onExpire={() => setTurnstileOk(false)}
                onError={() => setTurnstileOk(false)}
                options={{ theme: 'light', language: 'es' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="login-error" role="alert">
                <span>⚠</span> {error}
              </div>
            )}

            {/* Botón */}
            <button type="submit" className="login-btn"
              disabled={cargando || !turnstileOk}>
              {cargando
                ? <span className="btn-spinner" />
                : <><span>Ingresar al sistema</span><IconArrow /></>
              }
            </button>
          </form>

          <p className="form-footer">
            © {new Date().getFullYear()} YachayQR · Acceso solo para personal autorizado
          </p>
        </div>

      </div>
    </div>
  )
}
