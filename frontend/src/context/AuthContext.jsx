import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const rolGuardado = localStorage.getItem('rol')
    const nombreGuardado = localStorage.getItem('nombre_completo')
    if (token && rolGuardado) {
      setUsuario({ rol: rolGuardado, nombre_completo: nombreGuardado })
    }
    setCargando(false)
  }, [])

  const login = async (username, password, turnstileToken) => {
    const { data } = await api.post('/auth/login/', {
      username,
      password,
      cf_turnstile_token: turnstileToken,
    })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    localStorage.setItem('rol', data.rol)
    localStorage.setItem('nombre_completo', data.nombre_completo || username)
    setUsuario({ rol: data.rol, nombre_completo: data.nombre_completo || username })
    return data.rol
  }

  const logout = () => {
    localStorage.clear()
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
