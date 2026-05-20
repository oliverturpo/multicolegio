import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PlataformaAuthProvider } from './context/PlataformaAuthContext'
import { ProtectedRoute } from './router/ProtectedRoute'
import { PlataformaRoute } from './router/PlataformaRoute'
import Layout from './components/Layout/Layout'

import Landing                  from './pages/Landing'
import Login                    from './pages/Login'
import SinPermiso               from './pages/SinPermiso'
import EscanerPage              from './pages/Escaner'

import DirectorDashboard        from './pages/director/Dashboard'
import DirectorEscaner          from './pages/director/Escaner'
import DirectorAlumnos          from './pages/director/Alumnos'
import DirectorAsistencias      from './pages/director/Asistencias'
import DirectorReportes         from './pages/director/Reportes'
import DirectorUsuarios         from './pages/director/Usuarios'

import AuxiliarEscaner          from './pages/auxiliar/Escaner'
import AuxiliarAsistencias      from './pages/auxiliar/Asistencias'
import AuxiliarAlumnos          from './pages/auxiliar/Alumnos'

import PsicologoJustificaciones from './pages/psicologo/Justificaciones'
import PsicologoAlumnos         from './pages/psicologo/Alumnos'

import PlataformaLogin          from './pages/plataforma/Login'
import PlataformaColegios       from './pages/plataforma/Colegios'

const D = ['DIRECTOR']
const A = ['AUXILIAR']
const P = ['PSICOLOGO']
const E = ['ESCANER']

// ¿El host es el de un colegio (subdominio) o el dominio raíz?
//   mgcj.localhost / mgcj.yachayqr.pe → colegio (tenant)
//   localhost / 127.0.0.1 / yachayqr.pe / www.yachayqr.pe → raíz (landing)
function esHostDeColegio() {
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return false
  const partes = h.split('.')
  if (partes[partes.length - 1] === 'localhost') return partes.length > 1
  if (partes.length <= 2) return false
  if (partes.length === 3 && partes[0] === 'www') return false
  return true
}

// Raíz: el dominio del SaaS muestra la landing; un colegio va a su login.
function RootEntry() {
  return esHostDeColegio()
    ? <Navigate to="/login" replace />
    : <Landing />
}

function Wrap({ roles, children, fluid = false }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout fluid={fluid}>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <PlataformaAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pública */}
          <Route path="/login"       element={<Login />} />
          <Route path="/sin-permiso" element={<SinPermiso />} />

          {/* Plataforma — panel del dueño (schema public) */}
          <Route path="/plataforma/login"    element={<PlataformaLogin />} />
          <Route path="/plataforma/colegios" element={
            <PlataformaRoute><PlataformaColegios /></PlataformaRoute>
          } />
          <Route path="/plataforma" element={<Navigate to="/plataforma/colegios" replace />} />

          {/* Director */}
          <Route path="/director/dashboard"  element={<Wrap roles={D}><DirectorDashboard /></Wrap>} />
          <Route path="/director/escaner"    element={<Wrap roles={D} fluid><DirectorEscaner /></Wrap>} />
          <Route path="/director/alumnos"    element={<Wrap roles={D}><DirectorAlumnos /></Wrap>} />
          <Route path="/director/asistencias"element={<Wrap roles={D}><DirectorAsistencias /></Wrap>} />
          <Route path="/director/reportes"   element={<Wrap roles={D}><DirectorReportes /></Wrap>} />
          <Route path="/director/usuarios"   element={<Wrap roles={D}><DirectorUsuarios /></Wrap>} />

          {/* Auxiliar */}
          <Route path="/auxiliar/escaner"    element={<Wrap roles={A} fluid><AuxiliarEscaner /></Wrap>} />
          <Route path="/auxiliar/asistencias"element={<Wrap roles={A}><AuxiliarAsistencias /></Wrap>} />
          <Route path="/auxiliar/alumnos"    element={<Wrap roles={A}><AuxiliarAlumnos /></Wrap>} />

          {/* Psicólogo */}
          <Route path="/psicologo/justificaciones" element={<Wrap roles={P}><PsicologoJustificaciones /></Wrap>} />
          <Route path="/psicologo/alumnos"         element={<Wrap roles={P}><PsicologoAlumnos /></Wrap>} />

          {/* Dispositivo escáner — sin layout de admin */}
          <Route path="/escaner" element={
            <ProtectedRoute roles={E}><EscanerPage /></ProtectedRoute>
          } />

          {/* Raíz: landing del SaaS (dominio raíz) o login (subdominio) */}
          <Route path="/"  element={<RootEntry />} />
          <Route path="*"  element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </PlataformaAuthProvider>
    </AuthProvider>
  )
}
