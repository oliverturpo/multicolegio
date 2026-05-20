import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SinPermiso() {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#f9fafb' }}>
      <h1 style={{ fontSize: '3rem' }}>🚫</h1>
      <h2 style={{ color: '#111827' }}>Sin permiso</h2>
      <p style={{ color: '#6b7280' }}>No tienes acceso a esta sección.</p>
      <button onClick={() => { logout(); navigate('/login') }} style={{ padding: '0.6rem 1.5rem', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        Volver al inicio
      </button>
    </div>
  )
}
