// Seguimiento automático: Vercel ejecuta esta función cada 15 minutos (ver vercel.json).
import { env } from '../lib/config.js';
import { ejecutarSeguimiento } from '../lib/seguimiento.js';
import { log, guardarLogs } from '../lib/log.js';
import { alertaTecnica } from '../lib/telegram.js';
import { igualesSeguro, json } from '../lib/util.js';

export async function GET(request) {
  const secreto = env('CRON_SECRET');
  if (!secreto || !igualesSeguro(request.headers.get('authorization') || '', `Bearer ${secreto}`)) {
    return json({ error: 'No autorizado' }, 401);
  }
  try {
    const resultado = await ejecutarSeguimiento();
    return json(resultado);
  } catch (e) {
    log('ERROR', 'seguimiento_error', e.stack || e.message);
    await alertaTecnica('seguimiento', `Falló el envío automático de seguimiento: ${e.message}`);
    return json({ error: e.message }, 500);
  } finally {
    await guardarLogs();
  }
}
