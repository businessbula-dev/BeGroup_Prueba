// Webhook de WhatsApp: Meta llama a esta URL con cada mensaje.
// URL a configurar en Meta: https://<tu-proyecto>.vercel.app/api/webhook
import { waitUntil } from '@vercel/functions';
import { env } from '../lib/config.js';
import { firmaValida } from '../lib/whatsapp.js';
import { manejarWebhook } from '../lib/eventos.js';
import { log, guardarLogs } from '../lib/log.js';
import { alertaTecnica } from '../lib/telegram.js';
import { igualesSeguro } from '../lib/util.js';

// Verificación inicial que hace Meta al guardar la URL del webhook.
export function GET(request) {
  const u = new URL(request.url);
  const modo = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const desafio = u.searchParams.get('hub.challenge') || '';
  if (modo === 'subscribe' && token && env('WHATSAPP_VERIFY_TOKEN') && igualesSeguro(token, env('WHATSAPP_VERIFY_TOKEN'))) {
    log('INFO', 'webhook_verificado', 'Meta verificó la URL del webhook');
    waitUntil(guardarLogs());
    return new Response(desafio, { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  log('WARN', 'webhook_verificacion_fallida', 'El token de verificación no coincide con WHATSAPP_VERIFY_TOKEN');
  waitUntil(guardarLogs());
  return new Response('Token de verificación incorrecto', { status: 403 });
}

export async function POST(request) {
  const crudo = Buffer.from(await request.arrayBuffer());
  if (!firmaValida(crudo, request.headers.get('x-hub-signature-256'))) {
    log('ERROR', 'firma_invalida', 'Llegó un webhook con firma inválida. Si es de Meta, revisa META_APP_SECRET.');
    waitUntil(alertaTecnica('firma', 'Llegan webhooks con firma inválida: revisa META_APP_SECRET en Vercel.').finally(guardarLogs));
    return new Response('Firma inválida', { status: 401 });
  }
  let datos;
  try {
    datos = JSON.parse(crudo.toString('utf8'));
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }
  // Se responde 200 de inmediato (si Meta no recibe respuesta rápida, reintenta y duplica)
  // y el mensaje se procesa en segundo plano.
  waitUntil(manejarWebhook(datos).catch((e) => log('ERROR', 'webhook_error', e.stack || e.message)).finally(guardarLogs));
  return new Response('EVENT_RECEIVED', { status: 200 });
}
