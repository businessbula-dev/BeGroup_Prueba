import crypto from 'node:crypto';

export const ZONA = 'America/Santiago';

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

// Fecha en hora de Chile con su desfase, ej. 2026-10-23T15:30:00-03:00.
// Se lee fácil en la planilla y JavaScript la vuelve a interpretar sin ambigüedad.
export function ahoraISO(fecha = new Date()) {
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const desfase = Math.round((local - Math.floor(fecha.getTime() / 1000) * 1000) / 60000);
  const signo = desfase >= 0 ? '+' : '-';
  const abs = Math.abs(desfase);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${signo}${hh}:${mm}`;
}

export function aMilisegundos(texto) {
  if (!texto) return null;
  const t = Date.parse(String(texto).trim());
  return Number.isNaN(t) ? null : t;
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function sinTildes(texto = '') {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function esSi(valor) {
  return ['si', 'sí', 'true', '1', 'activo', 'yes'].includes(sinTildes(valor));
}

// Comparación en tiempo constante, para claves y firmas.
export function igualesSeguro(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb) && String(a ?? '').length === String(b ?? '').length;
}

export function json(datos, estado = 200) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function rellenar(plantilla, valores) {
  return String(plantilla).replace(/\{(\w+)\}/g, (_, k) => (valores[k] ?? '').toString());
}

export function recortar(texto, max) {
  const s = String(texto ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// +56 9 5220 1795 a partir de 56952201795 (solo para mostrar).
export function telefonoLegible(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.startsWith('569') && d.length === 11) return `+56 9 ${d.slice(3, 7)} ${d.slice(7)}`;
  return d ? `+${d}` : '';
}
