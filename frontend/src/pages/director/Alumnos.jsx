import { useState, useEffect, useCallback, useRef } from 'react'
import api, { API_BASE } from '../../services/api'
import './Alumnos.css'

// ── Íconos ───────────────────────────────────────────────────────
const IcoPlus    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoSearch  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoEdit    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IcoClose   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoUser    = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoCheck   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoPrint   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
const IcoBarcode = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="11" y1="8" x2="11" y2="16"/><line x1="15" y1="8" x2="15" y2="16"/><line x1="19" y1="8" x2="19" y2="12"/></svg>
const IcoFilter  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IcoRefresh = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>

// ── Helpers ───────────────────────────────────────────────────────
const ANIO_ACTUAL = new Date().getFullYear()

const FORM_ALUMNO_INICIAL = {
  dni: '', nombres: '', apellido_paterno: '', apellido_materno: '',
  sexo: '', fecha_nacimiento: '', foto: null, estado: 'ACTIVO',
  grado_seccion_id: '',
}
const FORM_APO_INICIAL = {
  dni: '', nombres: '', apellido_paterno: '', apellido_materno: '',
  sexo: '', parentesco: '', telefono_whatsapp: '',
}
const FORM_GRADO_INICIAL = {
  nivel: 'SECUNDARIA', grado: '', nombre_seccion: '', año_academico: ANIO_ACTUAL,
}

// ── Avatar ────────────────────────────────────────────────────────
function Avatar({ nombre, foto, size = 36 }) {
  if (foto) {
    return <img src={foto} alt={nombre} className="alu-avatar-img" style={{ width: size, height: size }} />
  }
  return (
    <div className="alu-avatar" style={{ width: size, height: size }}>
      {(nombre || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function Spinner({ size = 20, color = 'var(--navy)' }) {
  return <div className="alu-spinner" style={{ width: size, height: size, borderTopColor: color }} />
}

// ════════════════════════════════════════════════════════════════════
export default function DirectorAlumnos() {

  const [alumnos,     setAlumnos]     = useState([])
  const [grados,      setGrados]      = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [buscar,      setBuscar]      = useState('')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [total,       setTotal]       = useState(0)

  const [panelAbierto, setPanelAbierto] = useState(false)
  const [modoEdicion,  setModoEdicion]  = useState(false)
  const [alumnoEdit,   setAlumnoEdit]   = useState(null)
  const [guardando,    setGuardando]    = useState(false)
  const [errores,      setErrores]      = useState({})
  const [errorGlobal,  setErrorGlobal]  = useState('')
  const [exito,        setExito]        = useState('')

  const [fAlumno, setFAlumno] = useState(FORM_ALUMNO_INICIAL)

  const [apoModo,       setApoModo]       = useState('buscar')
  const [apoDniBusca,   setApoDniBusca]   = useState('')
  const [apoBuscando,   setApoBuscando]   = useState(false)
  const [apoEncontrado, setApoEncontrado] = useState(null)
  const [fApo,          setFApo]          = useState(FORM_APO_INICIAL)

  const [gradoModo, setGradoModo] = useState('seleccionar')
  const [fGrado,    setFGrado]    = useState(FORM_GRADO_INICIAL)

  const [fotoPreview, setFotoPreview] = useState(null)
  const fileRef   = useRef()
  const timerRef  = useRef()

  // ── Carga ──────────────────────────────────────────────────────
  const cargarAlumnos = useCallback(async () => {
    setCargando(true)
    try {
      const params = {}
      if (buscar)      params.buscar        = buscar
      if (filtroGrado) params.grado_seccion = filtroGrado
      const { data } = await api.get('/colegios/alumnos/', { params })
      const lista = data.results ?? data
      setAlumnos(lista)
      setTotal(data.count ?? lista.length)
    } catch {
      setErrorGlobal('No se pudo cargar la lista de alumnos.')
    } finally {
      setCargando(false)
    }
  }, [buscar, filtroGrado])

  const cargarGrados = useCallback(async () => {
    try {
      const { data } = await api.get('/colegios/grados/', { params: { año: ANIO_ACTUAL } })
      setGrados(data.results ?? data)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => { cargarGrados() }, [cargarGrados])
  useEffect(() => { cargarAlumnos() }, [cargarAlumnos])

  const handleBuscar = (v) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setBuscar(v), 400)
  }

  // ── Abrir panel ────────────────────────────────────────────────
  const resetPanel = () => {
    setFAlumno(FORM_ALUMNO_INICIAL)
    setFApo(FORM_APO_INICIAL); setApoModo('buscar'); setApoDniBusca(''); setApoEncontrado(null)
    setGradoModo('seleccionar'); setFGrado(FORM_GRADO_INICIAL)
    setFotoPreview(null); setErrores({}); setErrorGlobal(''); setExito('')
  }

  const abrirNuevo = () => {
    setModoEdicion(false); setAlumnoEdit(null)
    resetPanel(); setPanelAbierto(true)
  }

  const abrirEdicion = async (alumno) => {
    setModoEdicion(true); setAlumnoEdit(alumno)
    resetPanel(); setPanelAbierto(true)
    try {
      const { data } = await api.get(`/colegios/alumnos/${alumno.id}/`)
      setFAlumno({
        dni: data.dni, nombres: data.nombres,
        apellido_paterno: data.apellido_paterno, apellido_materno: data.apellido_materno,
        sexo: data.sexo, fecha_nacimiento: data.fecha_nacimiento,
        foto: null, estado: data.estado,
        grado_seccion_id: data.grado_seccion?.id ?? '',
      })
      if (data.apoderado) {
        const digits = (data.apoderado.telefono_whatsapp ?? '').replace(/\D/g, '')
        setApoEncontrado(data.apoderado)
        setFApo({ ...data.apoderado, telefono_whatsapp: digits.startsWith('51') ? digits.slice(2) : digits })
        setApoModo('encontrado')
        setApoDniBusca(data.apoderado.dni)
      }
      setFotoPreview(data.foto_url ?? null)
    } catch {
      setErrorGlobal('Error al cargar datos del alumno.')
    }
  }

  const cerrarPanel = () => {
    setPanelAbierto(false)
    setTimeout(resetPanel, 300)
  }

  // ── Buscar apoderado ───────────────────────────────────────────
  const buscarApoderado = async () => {
    if (apoDniBusca.length !== 8) return
    setApoBuscando(true)
    try {
      const { data } = await api.get('/colegios/apoderados/', { params: { buscar: apoDniBusca } })
      const lista = data.results ?? data
      const enc   = lista.find(a => a.dni === apoDniBusca)
      if (enc) {
        setApoEncontrado(enc)
        const digits = (enc.telefono_whatsapp ?? '').replace(/\D/g, '')
        setFApo({ ...enc, telefono_whatsapp: digits.startsWith('51') ? digits.slice(2) : digits })
        setApoModo('encontrado')
      } else {
        setApoEncontrado(null)
        setFApo({ ...FORM_APO_INICIAL, dni: apoDniBusca })
        setApoModo('nuevo')
      }
    } catch {
      setApoEncontrado(null)
      setFApo({ ...FORM_APO_INICIAL, dni: apoDniBusca })
      setApoModo('nuevo')
    } finally {
      setApoBuscando(false)
    }
  }

  // ── Foto ───────────────────────────────────────────────────────
  const handleFoto = (e) => {
    const file = e.target.files[0]; if (!file) return
    setFAlumno(p => ({ ...p, foto: file }))
    setFotoPreview(URL.createObjectURL(file))
  }

  // ── Guardar ────────────────────────────────────────────────────
  const handleGuardar = async (e) => {
    e.preventDefault()
    setErrores({}); setErrorGlobal(''); setExito('')

    const errs = {}
    if (!fAlumno.dni || fAlumno.dni.length !== 8) errs.dni = 'Debe tener 8 dígitos'
    if (!fAlumno.nombres.trim())          errs.nombres          = 'Obligatorio'
    if (!fAlumno.apellido_paterno.trim()) errs.apellido_paterno = 'Obligatorio'
    if (!fAlumno.apellido_materno.trim()) errs.apellido_materno = 'Obligatorio'
    if (!fAlumno.sexo)                    errs.sexo             = 'Obligatorio'
    if (!fAlumno.fecha_nacimiento)        errs.fecha_nacimiento = 'Obligatorio'
    if (gradoModo === 'seleccionar' && !fAlumno.grado_seccion_id) errs.grado_seccion_id = 'Selecciona una sección'
    if (apoModo !== 'encontrado') {
      if (!fApo.dni || fApo.dni.length !== 8)   errs.apo_dni             = 'Debe tener 8 dígitos'
      if (!fApo.nombres.trim())          errs.apo_nombres          = 'Obligatorio'
      if (!fApo.apellido_paterno.trim()) errs.apo_apellido_paterno = 'Obligatorio'
      if (!fApo.apellido_materno.trim()) errs.apo_apellido_materno = 'Obligatorio'
      if (!fApo.sexo)                    errs.apo_sexo             = 'Obligatorio'
      if (!fApo.parentesco)              errs.apo_parentesco       = 'Obligatorio'
      if (!fApo.telefono_whatsapp || fApo.telefono_whatsapp.length < 9) errs.apo_wsp = 'Ingresa 9 dígitos'
    } else {
      if (!fApo.telefono_whatsapp || fApo.telefono_whatsapp.length < 9) errs.apo_wsp = 'Ingresa 9 dígitos'
    }

    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)
    try {
      // 1. Crear grado si hace falta
      let gradoId = fAlumno.grado_seccion_id
      if (gradoModo === 'nuevo') {
        const { data: g } = await api.post('/colegios/grados/', {
          nivel: fGrado.nivel, grado: Number(fGrado.grado),
          nombre_seccion: fGrado.nombre_seccion, año_academico: Number(fGrado.año_academico),
        })
        gradoId = g.id
        await cargarGrados()
      }

      // 2. Apoderado
      let apoId = apoEncontrado?.id
      const wspFinal = '51' + fApo.telefono_whatsapp.replace(/\D/g, '')
      if (apoModo === 'nuevo') {
        const { data: apo } = await api.post('/colegios/apoderados/', { ...fApo, telefono_whatsapp: wspFinal })
        apoId = apo.id
      } else if (apoModo === 'encontrado' && wspFinal !== (apoEncontrado.telefono_whatsapp ?? '').replace(/\D/g, '')) {
        await api.patch(`/colegios/apoderados/${apoId}/`, { telefono_whatsapp: wspFinal })
      }

      // 3. Alumno
      const fd = new FormData()
      fd.append('dni',              fAlumno.dni)
      fd.append('nombres',          fAlumno.nombres)
      fd.append('apellido_paterno', fAlumno.apellido_paterno)
      fd.append('apellido_materno', fAlumno.apellido_materno)
      fd.append('sexo',             fAlumno.sexo)
      fd.append('fecha_nacimiento', fAlumno.fecha_nacimiento)
      fd.append('estado',           fAlumno.estado)
      fd.append('grado_seccion_id', gradoId)
      fd.append('apoderado_id',     apoId)
      if (fAlumno.foto) fd.append('foto', fAlumno.foto)

      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } }
      if (modoEdicion && alumnoEdit) {
        await api.patch(`/colegios/alumnos/${alumnoEdit.id}/`, fd, cfg)
        setExito('Alumno actualizado correctamente.')
      } else {
        await api.post('/colegios/alumnos/', fd, cfg)
        setExito('Alumno registrado correctamente.')
      }

      await cargarAlumnos()
      setTimeout(cerrarPanel, 1500)
    } catch (err) {
      const d = err.response?.data
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        const msgs = {}
        Object.entries(d).forEach(([k, v]) => { msgs[k] = Array.isArray(v) ? v[0] : String(v) })
        setErrores(msgs)
      }
      setErrorGlobal('Corrige los errores antes de guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Retirar alumno ─────────────────────────────────────────────
  const handleRetirar = async (alumno) => {
    if (!confirm(`¿Marcar a ${alumno.nombre_completo} como RETIRADO?\nNo podrá registrar asistencia.`)) return
    try {
      await api.patch(`/colegios/alumnos/${alumno.id}/`, { estado: 'RETIRADO' })
      await cargarAlumnos()
    } catch { setErrorGlobal('No se pudo retirar al alumno.') }
  }

  // Abrir PDF del carnet en nueva pestaña
  const abrirCarnet = (alumno) => {
    const token = localStorage.getItem('access_token') || ''
    // El PDF requiere auth — construimos la URL con el token en header via fetch+blob
    const url = `${API_BASE}/colegios/alumnos/${alumno.id}/carnet/`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const obj = URL.createObjectURL(blob)
        window.open(obj, '_blank')
      })
      .catch(() => setErrorGlobal('No se pudo generar el carnet.'))
  }

  const abrirCarnetSeccion = () => {
    if (!filtroGrado) { setErrorGlobal('Selecciona una sección para imprimir sus carnets.'); return }
    const token = localStorage.getItem('access_token') || ''
    const url = `${API_BASE}/colegios/alumnos/carnets-seccion/?grado_id=${filtroGrado}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const obj = URL.createObjectURL(blob)
        window.open(obj, '_blank')
      })
      .catch(() => setErrorGlobal('No se pudo generar los carnets.'))
  }

  // ══════════════════════════════════════════════════════════════
  return (
    <div className="alu-root">

      {/* CABECERA */}
      <div className="alu-header">
        <div>
          <h1 className="alu-title">Alumnos</h1>
          <p className="alu-subtitle">
            {cargando ? 'Cargando…' : `${total} alumno${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="alu-btn-primary" onClick={abrirNuevo}>
          <IcoPlus /> Nuevo alumno
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="alu-toolbar">
        <div className="alu-search-wrap">
          <IcoSearch />
          <input
            type="text"
            className="alu-search"
            placeholder="Buscar por nombre, apellido o DNI…"
            onChange={e => handleBuscar(e.target.value)}
          />
        </div>
        <div className="alu-filter-wrap">
          <IcoFilter />
          <select className="alu-select" value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)}>
            <option value="">Todas las secciones</option>
            {grados.map(g => (
              <option key={g.id} value={g.id}>
                {g.grado}° "{g.nombre_seccion}" — {g.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria'}
              </option>
            ))}
          </select>
        </div>
        <div className="alu-toolbar-ghosts">
          <button className="alu-btn-ghost" onClick={cargarAlumnos} title="Actualizar"><IcoRefresh /> <span className="alu-ghost-txt">Actualizar</span></button>
          <button className="alu-btn-ghost" onClick={abrirCarnetSeccion} title="Imprimir carnets de la sección filtrada">
            <IcoPrint /> Imprimir sección
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorGlobal && !panelAbierto && (
        <div className="alu-error-banner">⚠ {errorGlobal}</div>
      )}

      {/* TABLA */}
      <div className="alu-tabla-wrap">
        {cargando ? (
          <div className="alu-empty"><Spinner size={28} /><span>Cargando alumnos…</span></div>
        ) : alumnos.length === 0 ? (
          <div className="alu-empty">
            <div className="alu-empty-ico"><IcoUser /></div>
            <p>No hay alumnos registrados{buscar ? ` para "${buscar}"` : ''}.</p>
            <button className="alu-btn-primary" onClick={abrirNuevo}><IcoPlus /> Registrar primero</button>
          </div>
        ) : (
          <table className="alu-tabla">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>DNI</th>
                <th>Sección</th>
                <th>Apoderado</th>
                <th>WhatsApp</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map(a => (
                <tr key={a.id} className="alu-row">
                  <td className="alu-td-nombre" data-label="Alumno">
                    <div className="alu-nombre-cell">
                      <Avatar nombre={a.nombre_completo} foto={a.foto_url} size={40} />
                      <div className="alu-nombre-wrap">
                        <span className="alu-nombre">{a.nombre_completo}</span>
                        <span className="alu-nombre-sub">{a.grado_label ?? '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="DNI"><span className="alu-mono">{a.dni ?? '—'}</span></td>
                  <td data-label="Sección">{a.grado_label ?? '—'}</td>
                  <td className="alu-text-soft" data-label="Apoderado">{a.apoderado?.nombre_completo ?? '—'}</td>
                  <td className="alu-text-soft alu-mono" data-label="WhatsApp">{a.apoderado?.telefono_whatsapp ?? '—'}</td>
                  <td className="alu-td-acc" data-label="Acciones">
                    <div className="alu-acciones">
                      <button className="alu-ico-btn alu-ico-btn--edit" onClick={() => abrirEdicion(a)} title="Editar"><IcoEdit /> <span className="alu-ico-txt">Editar</span></button>
                      <button className="alu-ico-btn alu-ico-btn--print" onClick={() => abrirCarnet(a)} title="Imprimir carnet"><IcoPrint /> <span className="alu-ico-txt">Carnet</span></button>
                      {a.estado === 'ACTIVO' && (
                        <button className="alu-ico-btn alu-ico-btn--del" onClick={() => handleRetirar(a)} title="Retirar"><IcoTrash /> <span className="alu-ico-txt">Retirar</span></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PANEL LATERAL
      ═══════════════════════════════════════════════════════════ */}
      {panelAbierto && (
        <div className="alu-overlay" onClick={e => e.target === e.currentTarget && cerrarPanel()}>
          <div className="alu-panel">

            <div className="alu-panel-header">
              <h2 className="alu-panel-title">
                {modoEdicion ? 'Editar alumno' : 'Registrar nuevo alumno'}
              </h2>
              <button className="alu-panel-close" onClick={cerrarPanel}><IcoClose /></button>
            </div>

            <div className="alu-panel-body">
              <form onSubmit={handleGuardar} noValidate>

                {exito      && <div className="alu-exito"><IcoCheck /> {exito}</div>}
                {errorGlobal && <div className="alu-error-inline">⚠ {errorGlobal}</div>}

                {/* ─── SECCIÓN 1: ALUMNO ─────────────────────── */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="form-section-num">1</span> Datos del alumno
                  </div>

                  {/* Foto */}
                  <div className="foto-zone" onClick={() => fileRef.current?.click()}>
                    {fotoPreview
                      ? <img src={fotoPreview} alt="foto" className="foto-preview" />
                      : <div className="foto-placeholder"><IcoUser /><span>Agregar foto</span></div>
                    }
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
                    {fotoPreview && <span className="foto-cambiar">Cambiar foto</span>}
                  </div>

                  <div className="fg">
                    <label>DNI <span className="req">*</span></label>
                    <input type="text" maxLength={8}
                      value={fAlumno.dni}
                      onChange={e => setFAlumno(p => ({ ...p, dni: e.target.value.replace(/\D/g,'') }))}
                      placeholder="12345678"
                      className={errores.dni ? 'err' : ''}
                    />
                    {errores.dni && <span className="fg-err">{errores.dni}</span>}
                  </div>

                  <div className="fg">
                    <label>Nombres <span className="req">*</span></label>
                    <input type="text"
                      value={fAlumno.nombres}
                      onChange={e => setFAlumno(p => ({ ...p, nombres: e.target.value }))}
                      placeholder="Juan Carlos"
                      className={errores.nombres ? 'err' : ''}
                    />
                    {errores.nombres && <span className="fg-err">{errores.nombres}</span>}
                  </div>

                  <div className="fg-row">
                    <div className="fg">
                      <label>Ap. paterno <span className="req">*</span></label>
                      <input type="text"
                        value={fAlumno.apellido_paterno}
                        onChange={e => setFAlumno(p => ({ ...p, apellido_paterno: e.target.value }))}
                        placeholder="García"
                        className={errores.apellido_paterno ? 'err' : ''}
                      />
                      {errores.apellido_paterno && <span className="fg-err">{errores.apellido_paterno}</span>}
                    </div>
                    <div className="fg">
                      <label>Ap. materno <span className="req">*</span></label>
                      <input type="text"
                        value={fAlumno.apellido_materno}
                        onChange={e => setFAlumno(p => ({ ...p, apellido_materno: e.target.value }))}
                        placeholder="López"
                        className={errores.apellido_materno ? 'err' : ''}
                      />
                      {errores.apellido_materno && <span className="fg-err">{errores.apellido_materno}</span>}
                    </div>
                  </div>

                  <div className="fg-row">
                    <div className="fg">
                      <label>Sexo <span className="req">*</span></label>
                      <select value={fAlumno.sexo}
                        onChange={e => setFAlumno(p => ({ ...p, sexo: e.target.value }))}
                        className={errores.sexo ? 'err' : ''}
                      >
                        <option value="">— Seleccionar —</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                      {errores.sexo && <span className="fg-err">{errores.sexo}</span>}
                    </div>
                    <div className="fg">
                      <label>Fecha de nacimiento <span className="req">*</span></label>
                      <input type="date"
                        value={fAlumno.fecha_nacimiento}
                        onChange={e => setFAlumno(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                        max={new Date().toISOString().split('T')[0]}
                        className={errores.fecha_nacimiento ? 'err' : ''}
                      />
                      {errores.fecha_nacimiento && <span className="fg-err">{errores.fecha_nacimiento}</span>}
                    </div>
                  </div>

                  {modoEdicion && (
                    <div className="fg">
                      <label>Estado</label>
                      <select value={fAlumno.estado} onChange={e => setFAlumno(p => ({ ...p, estado: e.target.value }))}>
                        <option value="ACTIVO">Activo</option>
                        <option value="RETIRADO">Retirado</option>
                      </select>
                    </div>
                  )}

                  {/* Preview código barras */}
                  {fAlumno.dni.length === 8 && (
                    <div className="codigo-preview">
                      <IcoBarcode />
                      <span>Código (QR / barras): <strong>{fAlumno.dni}</strong></span>
                    </div>
                  )}
                </div>

                {/* ─── SECCIÓN 2: GRADO/SECCIÓN ──────────────── */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="form-section-num">2</span> Sección escolar
                  </div>

                  <div className="tab-toggle">
                    <button type="button"
                      className={gradoModo === 'seleccionar' ? 'active' : ''}
                      onClick={() => setGradoModo('seleccionar')}
                    >
                      Sección existente
                    </button>
                    <button type="button"
                      className={gradoModo === 'nuevo' ? 'active' : ''}
                      onClick={() => setGradoModo('nuevo')}
                    >
                      + Crear nueva
                    </button>
                  </div>

                  {gradoModo === 'seleccionar' ? (
                    <div className="fg">
                      <label>Sección <span className="req">*</span></label>
                      <select
                        value={fAlumno.grado_seccion_id}
                        onChange={e => setFAlumno(p => ({ ...p, grado_seccion_id: e.target.value }))}
                        className={errores.grado_seccion_id ? 'err' : ''}
                      >
                        <option value="">— Seleccionar sección —</option>
                        {grados.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.grado}° "{g.nombre_seccion}" — {g.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria'} {g.año_academico}
                          </option>
                        ))}
                      </select>
                      {errores.grado_seccion_id && <span className="fg-err">{errores.grado_seccion_id}</span>}
                      {grados.length === 0 && (
                        <span className="fg-hint">No hay secciones creadas. Usa "Crear nueva".</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="fg-row">
                        <div className="fg">
                          <label>Nivel <span className="req">*</span></label>
                          <select value={fGrado.nivel} onChange={e => setFGrado(p => ({ ...p, nivel: e.target.value }))}>
                            <option value="PRIMARIA">Primaria</option>
                            <option value="SECUNDARIA">Secundaria</option>
                          </select>
                        </div>
                        <div className="fg">
                          <label>Grado <span className="req">*</span></label>
                          <select value={fGrado.grado} onChange={e => setFGrado(p => ({ ...p, grado: e.target.value }))}>
                            <option value="">—</option>
                            {(fGrado.nivel === 'PRIMARIA' ? [1,2,3,4,5,6] : [1,2,3,4,5])
                              .map(n => <option key={n} value={n}>{n}°</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="fg-row">
                        <div className="fg">
                          <label>Nombre sección <span className="req">*</span></label>
                          <input type="text"
                            value={fGrado.nombre_seccion}
                            onChange={e => setFGrado(p => ({ ...p, nombre_seccion: e.target.value }))}
                            placeholder='A, B, "Albert Einstein"'
                          />
                        </div>
                        <div className="fg">
                          <label>Año académico <span className="req">*</span></label>
                          <input type="number"
                            value={fGrado.año_academico}
                            onChange={e => setFGrado(p => ({ ...p, año_academico: e.target.value }))}
                            min={2020} max={2040}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ─── SECCIÓN 3: APODERADO ──────────────────── */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="form-section-num">3</span> Apoderado / Tutor
                  </div>

                  {/* Buscar por DNI */}
                  <div className="apo-search-row">
                    <div className="fg" style={{ flex: 1, marginBottom: 0 }}>
                      <label>DNI del apoderado <span className="req">*</span></label>
                      <input type="text" maxLength={8}
                        value={apoDniBusca}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g,'')
                          setApoDniBusca(v)
                          if (apoModo !== 'buscar') { setApoModo('buscar'); setApoEncontrado(null) }
                        }}
                        placeholder="DNI apoderado"
                        className={errores.apo_dni ? 'err' : ''}
                      />
                      {errores.apo_dni && <span className="fg-err">{errores.apo_dni}</span>}
                    </div>
                    <button type="button" className="alu-btn-search"
                      onClick={buscarApoderado}
                      disabled={apoDniBusca.length !== 8 || apoBuscando}
                    >
                      {apoBuscando ? <Spinner size={15} color="#fff" /> : <IcoSearch />}
                      {apoBuscando ? 'Buscando…' : 'Buscar'}
                    </button>
                  </div>

                  {/* Encontrado */}
                  {apoModo === 'encontrado' && apoEncontrado && (
                    <div className="apo-encontrado">
                      <div className="apo-enc-info">
                        <span className="apo-enc-check"><IcoCheck /></span>
                        <div>
                          <p className="apo-enc-nombre">{apoEncontrado.nombre_completo}</p>
                          <p className="apo-enc-detalle">{apoEncontrado.parentesco} · DNI {apoEncontrado.dni}</p>
                        </div>
                      </div>
                      <button type="button" className="apo-cambiar-btn"
                        onClick={() => { setApoModo('buscar'); setApoEncontrado(null); setApoDniBusca('') }}>
                        Cambiar
                      </button>
                    </div>
                  )}

                  {/* WhatsApp siempre visible si encontrado */}
                  {apoModo === 'encontrado' && (
                    <div className="fg">
                      <label>WhatsApp <span className="req">*</span></label>
                      <div className="wsp-wrap">
                        <span className="wsp-prefix">+51</span>
                        <input type="tel" maxLength={9}
                          value={fApo.telefono_whatsapp}
                          onChange={e => setFApo(p => ({ ...p, telefono_whatsapp: e.target.value.replace(/\D/g,'') }))}
                          placeholder="987654321"
                          className={errores.apo_wsp ? 'err' : ''}
                        />
                      </div>
                      {errores.apo_wsp && <span className="fg-err">{errores.apo_wsp}</span>}
                      <span className="fg-hint">Se enviarán alertas de asistencia a este número.</span>
                    </div>
                  )}

                  {/* No encontrado → formulario completo */}
                  {apoModo === 'nuevo' && (
                    <div className="apo-nuevo-form">
                      <div className="apo-nuevo-aviso">
                        Apoderado no registrado. Completa los datos para crearlo.
                      </div>

                      <div className="fg">
                        <label>Nombres <span className="req">*</span></label>
                        <input type="text" value={fApo.nombres}
                          onChange={e => setFApo(p => ({ ...p, nombres: e.target.value }))}
                          placeholder="María Elena"
                          className={errores.apo_nombres ? 'err' : ''}
                        />
                        {errores.apo_nombres && <span className="fg-err">{errores.apo_nombres}</span>}
                      </div>

                      <div className="fg-row">
                        <div className="fg">
                          <label>Ap. paterno <span className="req">*</span></label>
                          <input type="text" value={fApo.apellido_paterno}
                            onChange={e => setFApo(p => ({ ...p, apellido_paterno: e.target.value }))}
                            placeholder="García"
                            className={errores.apo_apellido_paterno ? 'err' : ''}
                          />
                          {errores.apo_apellido_paterno && <span className="fg-err">{errores.apo_apellido_paterno}</span>}
                        </div>
                        <div className="fg">
                          <label>Ap. materno <span className="req">*</span></label>
                          <input type="text" value={fApo.apellido_materno}
                            onChange={e => setFApo(p => ({ ...p, apellido_materno: e.target.value }))}
                            placeholder="Torres"
                            className={errores.apo_apellido_materno ? 'err' : ''}
                          />
                          {errores.apo_apellido_materno && <span className="fg-err">{errores.apo_apellido_materno}</span>}
                        </div>
                      </div>

                      <div className="fg-row">
                        <div className="fg">
                          <label>Sexo <span className="req">*</span></label>
                          <select value={fApo.sexo}
                            onChange={e => setFApo(p => ({ ...p, sexo: e.target.value }))}
                            className={errores.apo_sexo ? 'err' : ''}
                          >
                            <option value="">— Seleccionar —</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                          </select>
                          {errores.apo_sexo && <span className="fg-err">{errores.apo_sexo}</span>}
                        </div>
                        <div className="fg">
                          <label>Parentesco <span className="req">*</span></label>
                          <select value={fApo.parentesco}
                            onChange={e => setFApo(p => ({ ...p, parentesco: e.target.value }))}
                            className={errores.apo_parentesco ? 'err' : ''}
                          >
                            <option value="">— Seleccionar —</option>
                            <option value="PADRE">Padre</option>
                            <option value="MADRE">Madre</option>
                            <option value="TUTOR">Tutor</option>
                            <option value="APODERADO">Apoderado</option>
                          </select>
                          {errores.apo_parentesco && <span className="fg-err">{errores.apo_parentesco}</span>}
                        </div>
                      </div>

                      <div className="fg">
                        <label>WhatsApp <span className="req">*</span></label>
                        <div className="wsp-wrap">
                          <span className="wsp-prefix">+51</span>
                          <input type="tel" maxLength={9}
                            value={fApo.telefono_whatsapp}
                            onChange={e => setFApo(p => ({ ...p, telefono_whatsapp: e.target.value.replace(/\D/g,'') }))}
                            placeholder="987654321"
                            className={errores.apo_wsp ? 'err' : ''}
                          />
                        </div>
                        {errores.apo_wsp && <span className="fg-err">{errores.apo_wsp}</span>}
                        <span className="fg-hint">Se enviarán alertas de asistencia a este número.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCIONES */}
                <div className="form-actions">
                  <button type="submit" className="alu-btn-primary" disabled={guardando}>
                    {guardando
                      ? <><Spinner size={16} color="#fff" /> Guardando…</>
                      : modoEdicion ? 'Actualizar alumno' : 'Registrar alumno'
                    }
                  </button>
                  <button type="button" className="alu-btn-ghost" onClick={cerrarPanel}>
                    Cancelar
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
