import axios from 'axios'

// Multi-tenant: el colegio se resuelve por el SUBDOMINIO del request
// (django-tenants lee el Host). Por eso la API debe apuntar al MISMO
// host donde se abre la app — no a uno fijo — y solo cambiar el puerto
// al del backend en desarrollo:
//   mgcj.localhost:5173 → http://mgcj.localhost:8000/api/v1  (schema mgcj)
//   127.0.0.1:5173      → http://127.0.0.1:8000/api/v1       (schema demo)
//   colegio.yachayqr.pe → https://colegio.yachayqr.pe/api/v1 (prod, mismo origen)
// VITE_API_URL queda solo como override explícito (backend en otro host).
function resolveApiBase() {
  const override = import.meta.env.VITE_API_URL
  if (override) return override
  const { protocol, hostname, port } = window.location
  const backendPort =
    port === '5173' || port === '5174' ? ':8000' : port ? `:${port}` : ''
  return `${protocol}//${hostname}${backendPort}/api/v1`
}

export const API_BASE = resolveApiBase()

const api = axios.create({
  baseURL: API_BASE,
})

// Adjunta el token JWT en cada request automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token expiró, intenta renovarlo automáticamente
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${API_BASE}/auth/refresh/`,
            { refresh }
          )
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
