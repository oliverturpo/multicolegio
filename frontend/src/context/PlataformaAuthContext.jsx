import { createContext, useContext, useState } from 'react'
import apiPlataforma from '../services/apiPlataforma'

const Ctx = createContext(null)

export function PlataformaAuthProvider({ children }) {
  const [duenio, setDuenio] = useState(() => {
    const t = localStorage.getItem('plataforma_access')
    const n = localStorage.getItem('plataforma_nombre')
    return t ? { nombre: n || 'Administrador' } : null
  })

  const login = async (username, password, turnstileToken) => {
    const { data } = await apiPlataforma.post('/plataforma/login/', {
      username,
      password,
      cf_turnstile_token: turnstileToken,
    })
    localStorage.setItem('plataforma_access', data.access)
    localStorage.setItem('plataforma_refresh', data.refresh)
    localStorage.setItem('plataforma_nombre', data.nombre_completo || username)
    setDuenio({ nombre: data.nombre_completo || username })
  }

  const logout = () => {
    localStorage.removeItem('plataforma_access')
    localStorage.removeItem('plataforma_refresh')
    localStorage.removeItem('plataforma_nombre')
    setDuenio(null)
  }

  return (
    <Ctx.Provider value={{ duenio, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePlataformaAuth = () => useContext(Ctx)
