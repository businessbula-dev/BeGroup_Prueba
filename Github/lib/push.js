// Notificaciones al celular (Web Push) para la app de chats del panel.
// Cada celular que activa las notificaciones queda en la pestaña "Dispositivos" de la planilla.
// Se notifica cuando un cliente pide hablar con una persona o comprar, y cuando deja sus datos para la llamada.
import webpush from 'web-push';
import { env } from './config.js';
import { puente, HOJAS } from './sheets.js';
import { log } from './log.js';
import { ahoraISO } from './util.js';

export const pushConfigurado = () => !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY'));
export const generarClavesPush = () => webpush.generateVAPIDKeys();

// En las pruebas se reemplaza el envío real.
let enviador = (suscripcion, datos, opciones) => webpush.sendNotification(suscripcion, datos, opciones);
export function usarEnviadorDePrueba(fn) { enviador = fn; }

const aObjeto = (f) => Object.fromEntries(HOJAS.Dispositivos.map((k, i) => [k, f[i] ?? '']));

export async function guardarSuscripcion(suscripcion, dispositivo = '') {
  if (!suscripcion?.endpoint || !suscripcion?.keys?.p256dh || !suscripcion?.keys?.auth) throw new Error('Suscripción inválida');
  const fila = [suscripcion.endpoint, JSON.stringify(suscripcion), ahoraISO(), String(dispositivo).slice(0, 120), 'sí'];
  await puente([{ op: 'upsert', hoja: 'Dispositivos', valor: suscripcion.endpoint, fila }]);
}

export async function quitarSuscripcion(endpoint) {
  const [filas] = await puente([{ op: 'leer', hoja: 'Dispositivos' }]);
  const d = (filas || []).slice(1).map(aObjeto).find((x) => x.endpoint === endpoint);
  if (d) await puente([{ op: 'upsert', hoja: 'Dispositivos', valor: endpoint, fila: HOJAS.Dispositivos.map((k) => (k === 'activo' ? 'no' : d[k])) }]);
}

export async function dispositivosActivos() {
  const [filas] = await puente([{ op: 'leer', hoja: 'Dispositivos' }]);
  return (filas || []).slice(1).map(aObjeto).filter((d) => d.endpoint && d.activo !== 'no');
}

// Envía la notificación a todos los celulares activos. Devuelve cuántos la recibieron.
export async function notificar({ titulo, cuerpo, telefono = '', etiqueta = '' }) {
  if (!pushConfigurado()) return 0;
  let dispositivos;
  try {
    dispositivos = await dispositivosActivos();
  } catch (e) {
    log('WARN', 'notificacion_error', `No se pudo leer la pestaña Dispositivos: ${e.message}`, telefono);
    return 0;
  }
  if (!dispositivos.length) return 0;
  const datos = JSON.stringify({
    titulo: String(titulo).slice(0, 120),
    cuerpo: String(cuerpo || '').slice(0, 400),
    url: telefono ? `/?chat=${encodeURIComponent(telefono)}` : '/',
    etiqueta: etiqueta || (telefono ? `chat-${telefono}` : 'begroup'),
  });
  const opciones = {
    vapidDetails: { subject: `mailto:${env('VAPID_EMAIL') || 'contacto@begroup.cl'}`, publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY') },
    TTL: 24 * 3600,
    urgency: 'high',
  };
  let enviados = 0;
  await Promise.all(dispositivos.map(async (d) => {
    try {
      await enviador(JSON.parse(d.suscripcion), datos, opciones);
      enviados += 1;
    } catch (e) {
      // 404/410: el celular desinstaló la app o revocó el permiso.
      if ([404, 410].includes(e.statusCode)) {
        await quitarSuscripcion(d.endpoint).catch(() => {});
        log('INFO', 'notificacion_dispositivo_quitado', `${d.dispositivo || 'dispositivo'} ya no acepta notificaciones`, telefono);
      } else {
        log('WARN', 'notificacion_error', `${d.dispositivo || 'dispositivo'}: ${e.statusCode || ''} ${e.body || e.message}`, telefono);
      }
    }
  }));
  log(enviados ? 'INFO' : 'WARN', 'notificacion_enviada', `${titulo} → ${enviados}/${dispositivos.length} dispositivo(s)`, telefono);
  return enviados;
}
