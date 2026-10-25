// Interpreta los eventos que envía Meta al webhook.
import { procesarMensajeCliente, procesarRespuestaHumana } from './bot.js';
import { log } from './log.js';
import { alertaTecnica } from './telegram.js';

function textoDe(m) {
  if (m.type === 'text') return m.text?.body || '';
  if (m.type === 'interactive') return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
  if (m.type === 'button') return m.button?.text || '';
  return '';
}

export async function manejarWebhook(datos) {
  for (const entrada of datos.entry || []) {
    for (const cambio of entrada.changes || []) {
      const v = cambio.value || {};
      const campo = cambio.field;

      if (campo === 'messages') {
        for (const m of v.messages || []) {
          if (m.type === 'reaction' || m.type === 'system') continue;
          const contacto = (v.contacts || []).find((c) => c.wa_id === m.from);
          await procesarMensajeCliente({
            telefono: m.from,
            nombre: contacto?.profile?.name || '',
            id: m.id,
            tipo: m.type,
            texto: textoDe(m),
          });
        }
        for (const s of v.statuses || []) {
          if (s.status === 'failed') {
            const err = (s.errors || []).map((e) => `${e.code} ${e.title || ''} ${e.error_data?.details || ''}`).join('; ');
            log('ERROR', 'envio_fallido', `WhatsApp no entregó el mensaje ${s.id}: ${err}`, s.recipient_id);
            await alertaTecnica(`envio-${(s.errors || [])[0]?.code || 'x'}`, `WhatsApp no pudo entregar un mensaje: ${err}`);
          }
        }
      } else if (campo === 'smb_message_echoes') {
        for (const eco of v.message_echoes || []) {
          await procesarRespuestaHumana({ telefono: eco.to, id: eco.id, tipo: eco.type, texto: eco.text?.body || '' });
        }
      } else if (campo === 'history' || campo === 'smb_app_state_sync') {
        log('INFO', 'historial_ignorado', `Evento "${campo}" de la coexistencia: el historial antiguo no se procesa`);
      } else {
        log('INFO', 'evento_ignorado', `Campo "${campo}"`);
      }
    }
  }
}
