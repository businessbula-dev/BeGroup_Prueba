// Registro de eventos: se ve en el panel (pestaña Logs de la planilla) y en los logs de Vercel.
import { agregar } from './sheets.js';
import { ahoraISO, recortar } from './util.js';

const pendientes = [];

export function log(nivel, evento, detalle = '', telefono = '') {
  const texto = typeof detalle === 'string' ? detalle : JSON.stringify(detalle);
  const salida = nivel === 'ERROR' ? console.error : nivel === 'WARN' ? console.warn : console.log;
  salida(`[${nivel}] ${evento}${telefono ? ` (${telefono})` : ''} ${texto}`);
  pendientes.push([ahoraISO(), nivel, evento, String(telefono || ''), recortar(texto, 4000)]);
}

// Entrega los logs pendientes para guardarlos junto con otra escritura (una sola llamada al Apps Script).
export function tomarLogs() {
  return pendientes.splice(0, pendientes.length);
}

export function devolverLogs(filas) {
  pendientes.unshift(...filas);
}

// Se llama al final de cada solicitud: escribe todos los logs pendientes en una sola operación.
export async function guardarLogs() {
  if (!pendientes.length) return;
  const filas = pendientes.splice(0, pendientes.length);
  try {
    await agregar('Logs', filas);
  } catch (e) {
    console.error('[ERROR] No se pudieron guardar los logs en la planilla:', e.message);
  }
}
