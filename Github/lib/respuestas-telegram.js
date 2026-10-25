// El dueño responde en Telegram (con "Responder" sobre la réplica de un chat) y el bot
// envía ese texto al cliente por WhatsApp. Luego el bot se calla en ese chat por unas horas.
import { env } from './config.js';
import { enviarTelegram } from './telegram.js';
import { enviarTexto } from './whatsapp.js';
import { buscarCliente } from './sheets.js';
import { pausarPorRespuestaHumana, reactivarBot, marcarResultado } from './bot.js';
import { leerReferencia, lineaReferencia } from './espejo.js';
import { log } from './log.js';
import { telefonoLegible } from './util.js';

const AYUDA = 'Para contestarle a un cliente, mantén presionado su mensaje en este chat → "Responder" y escribe tu respuesta.\n\nComandos (también con "Responder" sobre el mensaje del cliente):\n/bot → el bot vuelve a atender ese chat\n/venta [detalle] → registra la venta\n/perdido [motivo] → no compró\n/abierto → borra el resultado';

export async function procesarUpdateTelegram(update) {
  const m = update.message;
  if (!m) return;
  const chat = String(m.chat?.id ?? '');
  if (!env('TELEGRAM_CHAT_ID') || chat !== String(env('TELEGRAM_CHAT_ID'))) {
    const nombre = m.chat?.title || [m.chat?.first_name, m.chat?.last_name].filter(Boolean).join(' ');
    log('WARN', 'telegram_chat_desconocido', `Mensaje desde el chat ${chat} (${nombre}). Se ignora. Si es el chat de alertas, pon ${chat} en TELEGRAM_CHAT_ID.`);
    return;
  }
  const responder = (texto) => enviarTelegram(texto, { reply_to_message_id: m.message_id });
  const texto = String(m.text || '').trim();
  const telefono = leerReferencia(m.reply_to_message?.text);

  if (!telefono) {
    if (/^\/(start|ayuda|help)/i.test(texto) || texto) await responder(AYUDA);
    return;
  }
  const cliente = await buscarCliente(telefono);
  const nombre = cliente?.contacto_nombre || cliente?.nombre_perfil || telefonoLegible(telefono);

  const comando = /^\/(venta|perdido|abierto)\b\s*(.*)$/is.exec(texto);
  if (comando) {
    const resultado = comando[1].toLowerCase() === 'abierto' ? '' : comando[1].toLowerCase();
    await marcarResultado(telefono, resultado, comando[2].trim());
    const textoResultado = { venta: '💰 Venta registrada', perdido: '📕 Marcado como sin venta', '': '↩️ Resultado borrado' }[resultado];
    await responder(`${textoResultado} para ${nombre}${comando[2].trim() ? `: ${comando[2].trim()}` : ''}. Se ve en Métricas del panel.\n\n${lineaReferencia(telefono)}`);
    return;
  }
  if (/^\/bot\b/i.test(texto)) {
    await reactivarBot(telefono);
    log('INFO', 'bot_reactivado', 'Reactivado desde Telegram', telefono);
    await responder(`🤖 Bot reactivado en el chat de ${nombre}.\n\n${lineaReferencia(telefono)}`);
    return;
  }
  if (!texto) {
    await responder('Por ahora solo se pueden enviar mensajes de texto al cliente.');
    return;
  }

  let id;
  try {
    id = await enviarTexto(telefono, texto);
  } catch (e) {
    log('ERROR', 'respuesta_telegram_fallida', e.message, telefono);
    const fuera = e.codigo === 131047;
    await responder(fuera
      ? `❌ No se envió: pasaron más de 24 horas desde el último mensaje de ${nombre}, y WhatsApp no permite escribirle hasta que vuelva a escribir. Puedes llamarlo al ${telefonoLegible(telefono)}.`
      : `❌ No se pudo enviar a ${nombre}: ${e.message}`);
    return;
  }
  const autor = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ');
  const { horas } = await pausarPorRespuestaHumana({ telefono, id, texto, autor: 'persona', tipo: 'telegram' });
  log('INFO', 'respuesta_desde_telegram', `${autor || 'Persona'} respondió por Telegram; bot en pausa ${horas} h en este chat`, telefono);
  await responder(`✅ Enviado a ${nombre}. El bot queda en pausa ${horas} h en este chat (responde /bot para reactivarlo).\n\n${lineaReferencia(telefono)}`);
}
