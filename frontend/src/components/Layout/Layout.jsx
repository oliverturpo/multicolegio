import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  IcoDashboard, IcoEscaner, IcoAlumnos, IcoAsistencia,
  IcoJustificaciones, IcoReportes, IcoUsuarios,
  IcoLogout, IcoMenu, IcoCampana,
} from './icons'
import './Layout.css'

// ── Menú por rol ─────────────────────────────────────────────────
const MENU = {
  DIRECTOR: [
    { label: 'Dashboard',      path: '/director/dashboard',       icon: <IcoDashboard /> },
    { label: 'Escáner',        path: '/director/escaner',         icon: <IcoEscaner /> },
    { label: 'Alumnos',        path: '/director/alumnos',         icon: <IcoAlumnos /> },
    { label: 'Asistencias',    path: '/director/asistencias',     icon: <IcoAsistencia /> },
    { label: 'Reportes',       path: '/director/reportes',        icon: <IcoReportes /> },
    { label: 'Usuarios',       path: '/director/usuarios',        icon: <IcoUsuarios /> },
  ],
  AUXILIAR: [
    { label: 'Escáner',        path: '/auxiliar/escaner',         icon: <IcoEscaner /> },
    { label: 'Asistencias',    path: '/auxiliar/asistencias',     icon: <IcoAsistencia /> },
    { label: 'Alumnos',        path: '/auxiliar/alumnos',         icon: <IcoAlumnos /> },
  ],
  PSICOLOGO: [
    { label: 'Justificaciones',path: '/psicologo/justificaciones',icon: <IcoJustificaciones /> },
    { label: 'Alumnos',        path: '/psicologo/alumnos',        icon: <IcoAlumnos /> },
  ],
}

// ── Avatar con inicial ───────────────────────────────────────────
const Avatar = ({ nombre }) => (
  <div className="avatar">
    {nombre?.charAt(0).toUpperCase() || '?'}
  </div>
)

// ── Badge de rol ─────────────────────────────────────────────────
const ROL_LABEL = {
  DIRECTOR:  'Director',
  AUXILIAR:  'Auxiliar',
  PSICOLOGO: 'Psicólogo',
  ESCANER:   'Escáner',
}

// ── Componente principal ─────────────────────────────────────────
export default function Layout({ children, fluid = false }) {
  const { usuario, logout }   = useAuth()
  const navigate              = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const menu = MENU[usuario?.rol] || []

  // ── Navegación inferior (mobile) ───────────────────────────────
  // El Escáner se eleva como botón central (FAB); el resto de ítems
  // se reparten a izquierda y derecha, como en el diseño de celular.
  const escanerItem = menu.find((m) => m.path.endsWith('/escaner'))
  const otrosItems  = menu.filter((m) => m !== escanerItem)
  const mitad       = Math.ceil(otrosItems.length / 2)
  const navIzq      = otrosItems.slice(0, mitad)
  const navDer      = otrosItems.slice(mitad)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''} ${mobileOpen ? 'layout--mobile-open' : ''}`}>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <QRMini />
          </div>
          {!collapsed && (
            <span className="sidebar-logo-text">
              Yachay<span className="sidebar-logo-accent">QR</span>
            </span>
          )}
        </div>

        {/* Navegación */}
        <nav className="sidebar-nav">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar-link-label">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Usuario + logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Avatar nombre={usuario?.nombre_completo} />
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">
                  {usuario?.nombre_completo || 'Usuario'}
                </span>
                <span className="sidebar-user-rol">
                  {ROL_LABEL[usuario?.rol] || usuario?.rol}
                </span>
              </div>
            )}
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <IcoLogout />
          </button>
        </div>
      </aside>

      {/* ── Área principal ────────────────────────────────────── */}
      <div className="layout-main">

        {/* Topbar */}
        <header className="topbar">
          <button
            className="topbar-menu-btn"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileOpen(o => !o)
              } else {
                setCollapsed(c => !c)
              }
            }}
            title="Contraer menú"
          >
            <IcoMenu />
          </button>

          <div className="topbar-right">
            <button className="topbar-icon-btn" title="Notificaciones">
              <IcoCampana />
              <span className="topbar-badge">3</span>
            </button>
            <div className="topbar-user">
              <Avatar nombre={usuario?.nombre_completo} />
              <span className="topbar-user-name">
                {usuario?.nombre_completo}
              </span>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className={`layout-content${fluid ? ' layout-content--fluid' : ''}`}>
          {children}
        </main>
      </div>

      {/* ── Navegación inferior (solo celular) ─────────────────── */}
      <nav className="bottomnav">
        {navIzq.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `bottomnav-item ${isActive ? 'bottomnav-item--active' : ''}`
            }
          >
            <span className="bottomnav-icon">{item.icon}</span>
            <span className="bottomnav-label">{item.label}</span>
          </NavLink>
        ))}

        {escanerItem && (
          <NavLink
            to={escanerItem.path}
            className={({ isActive }) =>
              `bottomnav-fab ${isActive ? 'bottomnav-fab--active' : ''}`
            }
            aria-label={escanerItem.label}
          >
            <span className="bottomnav-fab-icon">{escanerItem.icon}</span>
          </NavLink>
        )}

        {navDer.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `bottomnav-item ${isActive ? 'bottomnav-item--active' : ''}`
            }
          >
            <span className="bottomnav-icon">{item.icon}</span>
            <span className="bottomnav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  )
}

// QR mini para el logo del sidebar
const QRMini = () => (
  <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="#fbbf24" strokeWidth="1.8"/>
    <rect x="4" y="4" width="6" height="6" rx="0.5" fill="#fbbf24"/>
    <rect x="16" y="2" width="10" height="10" rx="1.5" stroke="#fbbf24" strokeWidth="1.8"/>
    <rect x="18" y="4" width="6" height="6" rx="0.5" fill="#fbbf24"/>
    <rect x="2" y="16" width="10" height="10" rx="1.5" stroke="#fbbf24" strokeWidth="1.8"/>
    <rect x="4" y="18" width="6" height="6" rx="0.5" fill="#fbbf24"/>
    <rect x="16" y="16" width="3" height="3" fill="#fbbf24"/>
    <rect x="21" y="16" width="3" height="3" fill="#fbbf24"/>
    <rect x="16" y="21" width="3" height="3" fill="#fbbf24"/>
    <rect x="21" y="21" width="3" height="3" fill="#fbbf24"/>
  </svg>
)
