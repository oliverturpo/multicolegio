import { Navigate } from 'react-router-dom'
import { usePlataformaAuth } from '../context/PlataformaAuthContext'

export function PlataformaRoute({ children }) {
  const { duenio } = usePlataformaAuth()
  if (!duenio) return <Navigate to="/plataforma/login" replace />
  return children
}
