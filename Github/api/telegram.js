// Webhook de Telegram: recibe las respuestas del dueño. Se conecta con el botón
// "Conectar respuestas por Telegram" del panel.
import { waitUntil } from '@vercel/functions';
import { secretoWebhookTelegram } from '../lib/telegram.js';
import { procesarUpdateTelegram } from '../lib/respuestas-telegram.js';
import { log, guardarLogs } from '../lib/log.js';
import { igualesSeguro } from '../lib/util.js';

export async function POST(request) {
  const clave = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!igualesSeguro(clave, secretoWebhookTelegram())) {
    log('WARN', 'telegram_webhook_no_autorizado', 'Llamada al webhook de Telegram sin la clave correcta');
    waitUntil(guardarLogs());
    return new Response('No autorizado', { status: 401 });
  }
  let update;
  try { update = await request.json(); } catch { return new Response('JSON inválido', { status: 400 }); }
  waitUntil(procesarUpdateTelegram(update).catch((e) => log('ERROR', 'telegram_webhook_error', e.stack || e.message)).finally(guardarLogs));
  return new Response('ok', { status: 200 });
}
