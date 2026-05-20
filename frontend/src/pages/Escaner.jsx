import { useAuth } from '../context/AuthContext'

export default function EscanerPage() {
  const { usuario, logout } = useAuth()
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Modo Escáner</h1>
      <p>Dispositivo: {usuario?.nombre_completo}</p>
      <button onClick={logout}>Cerrar sesión</button>
    </div>
  )
}
