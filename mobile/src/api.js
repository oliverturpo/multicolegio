// Cliente de la API de YachayQR para la app de apoderados.
//
// - El selector de colegios es público y vive en el dominio principal.
// - El resto de llamadas van al subdominio del colegio elegido; el header
//   Host resuelve el schema (multi-tenant) en el backend.

const PUBLIC_BASE = 'https://yachayqr.com/api/v1';

const apoBase = (dominio) => `https://${dominio}/api/v1/apoderado`;

async function parse(resp) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.detail || 'Ocurrió un error. Intenta de nuevo.');
  }
  return data;
}

export async function getColegios() {
  const r = await fetch(`${PUBLIC_BASE}/colegios-publicos/`);
  return parse(r);
}

export async function login(dominio, dni, password) {
  const r = await fetch(`${apoBase(dominio)}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dni, password }),
  });
  return parse(r);
}

export async function cambiarPassword(dominio, token, passwordNueva) {
  const r = await fetch(`${apoBase(dominio)}/cambiar-password/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password_nueva: passwordNueva }),
  });
  return parse(r);
}

export async function getMisHijos(dominio, token) {
  const r = await fetch(`${apoBase(dominio)}/mis-hijos/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(r);
}

export async function getAsistencias(dominio, token, alumnoId) {
  const r = await fetch(`${apoBase(dominio)}/hijo/${alumnoId}/asistencias/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(r);
}
