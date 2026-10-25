// Alertas al equipo de BE Group por Telegram (gratis, sin ventana de 24 horas).
import crypto from 'node:crypto';
import { env } from './config.js';
import { log } from './log.js';

async function llamar(metodo, cuerpo) {
  const token = env('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN');
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo || {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(`Telegram: ${d.description || r.status}`);
  return d.result;
}

export async function enviarTelegram(texto, extra = {}) {
  const chat = env('TELEGRAM_CHAT_ID');
  if (!env('TELEGRAM_BOT_TOKEN') || !chat) {
    log('WARN', 'telegram_sin_configurar', 'No se envió la alerta: faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');
    return false;
  }
  try {
    const r = await llamar('sendMessage', { chat_id: chat, text: texto.slice(0, 4000), disable_web_page_preview: true, ...extra });
    return r?.message_id || true;
  } catch (e) {
    log('ERROR', 'telegram_error', e.message);
    return false;
  }
}

// Tarjeta de contacto: con un toque se guarda en el teléfono o se abre el chat.
export async function enviarContactoTelegram(telefono, nombre) {
  const chat = env('TELEGRAM_CHAT_ID');
  if (!env('TELEGRAM_BOT_TOKEN') || !chat || !/^\d{8,15}$/.test(String(telefono))) return false;
  try {
    await llamar('sendContact', { chat_id: chat, phone_number: `+${telefono}`, first_name: (nombre || 'Cliente').slice(0, 60), last_name: 'BE Group' });
    return true;
  } catch (e) {
    log('WARN', 'telegram_contacto_error', e.message);
    return false;
  }
}

// Avisos técnicos con freno: como máximo uno cada 10 minutos por tipo de problema.
const ultimos = new Map();
export async function alertaTecnica(tipo, texto) {
  if (Date.now() - (ultimos.get(tipo) || 0) < 10 * 60 * 1000) return;
  ultimos.set(tipo, Date.now());
  await enviarTelegram(`⚠️ Agente WhatsApp BE Group: problema técnico\n${texto}\n\nRevisa el panel de logs.`);
}

export async function infoTelegram() {
  const yo = await llamar('getMe');
  return `@${yo.username}`;
}

// Para descubrir el TELEGRAM_CHAT_ID: chats que le escribieron al bot recientemente.
export async function chatsRecientes() {
  let updates;
  try {
    updates = await llamar('getUpdates', { limit: 50 });
  } catch (e) {
    if (/webhook/i.test(e.message)) {
      throw new Error('Las respuestas por Telegram ya están conectadas, y en ese modo Telegram no entrega la lista de chats. Escríbele al bot desde el chat que quieras usar y busca el evento telegram_chat_desconocido en Logs: ahí aparece su número.');
    }
    throw e;
  }
  const vistos = new Map();
  for (const u of updates) {
    const c = (u.message || u.channel_post || u.my_chat_member || {}).chat;
    if (c) vistos.set(c.id, { id: c.id, nombre: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || '', tipo: c.type });
  }
  return [...vistos.values()];
}

// ---------- Respuestas del dueño desde Telegram ----------

// Clave que Telegram envía en cada llamada al webhook. Se deriva del token: no requiere otra variable.
export function secretoWebhookTelegram() {
  const token = env('TELEGRAM_BOT_TOKEN') || '';
  return crypto.createHash('sha256').update(`webhook:${token}`).digest('hex').slice(0, 48);
}

export async function conectarWebhookTelegram(url) {
  await llamar('setWebhook', { url, secret_token: secretoWebhookTelegram(), allowed_updates: ['message'], drop_pending_updates: true });
  return url;
}

export async function infoWebhookTelegram() {
  return llamar('getWebhookInfo');
}
