// Réplica de WhatsApp en Telegram: cada mensaje del cliente (y lo que respondió el bot) llega al
// chat de Telegram de BE Group. Respondiendo a ese mensaje en Telegram, la respuesta sale por WhatsApp.
import { enviarTelegram } from './telegram.js';
import { esSi, recortar, telefonoLegible } from './util.js';

// Esta línea al final de cada réplica es la que permite saber a qué cliente se está respondiendo.
export const lineaReferencia = (telefono) => `↩️ Responde a este mensaje para contestarle por WhatsApp · ref ${telefono}`;
export const leerReferencia = (texto) => /ref (\d{8,15})\b/.exec(texto || '')?.[1] || null;

const ICONOS = { cliente: '👤', bot: '🤖', persona: '🧑‍💼' };

export async function replicarEnTelegram(cliente, registros, config, nota = '') {
  if (!esSi(config.replicar_telegram ?? 'sí')) return;
  if (!/^\d{8,15}$/.test(String(cliente.telefono))) return; // simulador u otros
  const lineas = registros.map((r) => {
    const quien = r.autor === 'cliente' ? 'Cliente' : r.autor === 'bot' ? 'Bot' : 'Persona';
    const largo = r.autor === 'cliente' ? 1500 : 220;
    return `${ICONOS[r.autor] || '•'} ${quien}: ${recortar(r.texto, largo)}`;
  });
  const titulo = `💬 ${cliente.contacto_nombre || cliente.nombre_perfil || 'Cliente'} · ${telefonoLegible(cliente.telefono)}`;
  await enviarTelegram([titulo, ...lineas, ...(nota ? [nota] : []), '', lineaReferencia(cliente.telefono)].join('\n'));
}
