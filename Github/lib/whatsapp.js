// WhatsApp Cloud API (Meta).
import crypto from 'node:crypto';
import { env } from './config.js';
import { igualesSeguro } from './util.js';

async function graph(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = env('WHATSAPP_TOKEN');
  if (!token) throw new Error('Falta WHATSAPP_TOKEN');
  const r = await fetch(`https://graph.facebook.com/${env('WHATSAPP_API_VERSION')}${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = d.error || {};
    let msg = `WhatsApp: ${e.message || r.status}${e.code ? ` (código ${e.code})` : ''}`;
    if (e.code === 190) msg += ' → el token venció o es inválido: usa un token permanente de usuario del sistema';
    if (e.code === 131047) msg += ' → pasaron más de 24 h desde el último mensaje del cliente';
    if (e.code === 131030) msg += ' → número de prueba: agrega este destinatario en el panel de Meta';
    const err = new Error(msg);
    err.codigo = e.code;
    throw err;
  }
  return d;
}

export async function enviarTexto(para, texto) {
  const id = env('WHATSAPP_PHONE_NUMBER_ID');
  if (!id) throw new Error('Falta WHATSAPP_PHONE_NUMBER_ID');
  const d = await graph(`/${id}/messages`, {
    metodo: 'POST',
    cuerpo: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: para,
      type: 'text',
      text: { body: String(texto).slice(0, 4096), preview_url: /https?:\/\//.test(texto) },
    },
  });
  return d.messages?.[0]?.id || '';
}

// Marca el mensaje como leído y muestra "escribiendo…" mientras se prepara la respuesta.
export async function marcarLeido(idMensaje) {
  const id = env('WHATSAPP_PHONE_NUMBER_ID');
  if (!id || !idMensaje) return;
  try {
    await graph(`/${id}/messages`, {
      metodo: 'POST',
      cuerpo: { messaging_product: 'whatsapp', status: 'read', message_id: idMensaje, typing_indicator: { type: 'text' } },
    });
  } catch {
    // No es crítico.
  }
}

// Registra el número en Cloud API con el PIN de verificación en dos pasos (6 dígitos).
// Obligatorio una vez al pasar el número real a la API (Meta: máx. 10 intentos cada 72 horas).
export async function registrarNumero(pin) {
  const id = env('WHATSAPP_PHONE_NUMBER_ID');
  if (!id) throw new Error('Falta WHATSAPP_PHONE_NUMBER_ID');
  return graph(`/${id}/register`, { metodo: 'POST', cuerpo: { messaging_product: 'whatsapp', pin: String(pin) } });
}

export async function infoNumero() {
  const d = await graph(`/${env('WHATSAPP_PHONE_NUMBER_ID')}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`);
  return d;
}

// Meta firma cada webhook con la clave secreta de la app; así se descartan mensajes falsos.
export function firmaValida(cuerpoCrudo, cabecera) {
  const secreto = env('META_APP_SECRET');
  if (!secreto || !cabecera || !String(cabecera).startsWith('sha256=')) return false;
  const esperado = `sha256=${crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex')}`;
  return igualesSeguro(esperado, cabecera);
}
