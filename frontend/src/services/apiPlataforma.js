import axios from 'axios'

// El panel del dueño vive en el schema `public` → host principal
// (en dev: localhost:8000, NO 127.0.0.1 que es el tenant demo).
const BASE = import.meta.env.VITE_PLATAFORMA_API_URL || 'http://localhost:8000/api/v1'

const apiPlataforma = axios.create({ baseURL: BASE })

apiPlataforma.interceptors.request.use((config) => {
  const token = localStorage.getItem('plataforma_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiPlataforma.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('plataforma_refresh')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh/`, { refresh })
          localStorage.setItem('plataforma_access', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return apiPlataforma(original)
        } catch {
          localStorage.removeItem('plataforma_access')
          localStorage.removeItem('plataforma_refresh')
          localStorage.removeItem('plataforma_nombre')
          window.location.href = '/plataforma/login'
        }
      } else {
        window.location.href = '/plataforma/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiPlataforma
