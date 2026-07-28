// Paleta oficial YachayQR (ver CLAUDE.md)
export const C = {
  navy:     '#0f2a4c',
  navyMid:  '#1e3a5f',
  gold:     '#fbbf24',
  goldDark: '#f59e0b',

  bg:     '#f8fafc',
  card:   '#ffffff',
  border: '#e6ebf2',
  ink:    '#16233a',
  sub:    '#64748b',

  // Semánticos de asistencia
  presente:   '#16a34a', presenteBg: '#dcfce7',
  tardanza:   '#d97706', tardanzaBg: '#fef3c7',
  ausente:    '#dc2626', ausenteBg:  '#fee2e2',
  justificado:'#2563eb', justificadoBg:'#dbeafe',
};

const ESTADOS = {
  PRESENTE:    { label: 'Presente',    color: C.presente,    bg: C.presenteBg },
  TARDANZA:    { label: 'Tardanza',    color: C.tardanza,    bg: C.tardanzaBg },
  AUSENTE:     { label: 'Ausente',     color: C.ausente,     bg: C.ausenteBg },
  JUSTIFICADO: { label: 'Justificado', color: C.justificado, bg: C.justificadoBg },
};

export function estadoInfo(estado) {
  return ESTADOS[estado] || { label: estado || '—', color: C.sub, bg: '#eef2f7' };
}

// Iniciales para el avatar de un nombre
export function iniciales(nombre = '') {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
