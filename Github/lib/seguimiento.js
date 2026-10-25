// Seguimiento: a quien recibió la bienvenida y no eligió a, b ni c, se le envían los
// 3 mensajes del modelo de seguimiento (Villa), dentro de las 24 h en que WhatsApp permite escribirle.
import { contenido, leerClientes, guardarCliente, registrarConversacion } from './sheets.js';
import { enviarTexto } from './whatsapp.js';
import { MODELOS } from './bot.js';
import { log } from './log.js';
import { replicarEnTelegram } from './espejo.js';
import { ahoraISO, aMilisegundos, esperar, esSi } from './util.js';

const VENTANA_SEGURA_MS = 23 * 3600 * 1000; // margen bajo las 24 h de WhatsApp

export async function ejecutarSeguimiento(ahora = Date.now()) {
  const cont = await contenido({ fresco: true });
  const modelo = String(cont.config.modelo_seguimiento || '').toUpperCase();
  if (!esSi(cont.config.bot_activo) || !MODELOS[modelo]) return { enviados: 0, motivo: 'desactivado' };
  const espera = (Number(cont.config.minutos_seguimiento) || 120) * 60 * 1000;
  const pausaEntre = Math.max(0, Number(cont.config.segundos_entre_mensajes) || 0) * 1000;

  const clientes = await leerClientes();
  let enviados = 0;
  for (const c of clientes) {
    if (c.estado !== 'esperando_modelo' || c.seguimiento_enviado || !/^\d+$/.test(c.telefono)) continue;
    const bienvenida = aMilisegundos(c.bienvenida_enviada);
    const ultimo = aMilisegundos(c.ultimo_mensaje_cliente);
    const pausa = aMilisegundos(c.pausado_hasta);
    if (!bienvenida || ahora - bienvenida < espera) continue;
    if (!ultimo || ahora - ultimo > VENTANA_SEGURA_MS) continue;
    if (pausa && pausa > ahora) continue;

    const registros = [];
    try {
      for (const n of [1, 2, 3]) {
        const t = cont.mensajes[`${modelo}_${n}`];
        if (!t) continue;
        if (registros.length) await esperar(pausaEntre);
        const id = await enviarTexto(c.telefono, t);
        registros.push({ fecha: ahoraISO(), telefono: c.telefono, autor: 'bot', tipo: 'seguimiento', texto: t, wa_id: id });
      }
      c.seguimiento_enviado = ahoraISO();
      c.estado = 'seguimiento_enviado';
      c.modelo_interes = c.modelo_interes || modelo;
      enviados += 1;
      log('INFO', 'seguimiento_enviado', modelo, c.telefono);
      await replicarEnTelegram(c, [{ autor: 'bot', texto: `(seguimiento automático: envió los ${registros.length} mensajes del ${modelo})` }], cont.config).catch(() => {});
    } catch (e) {
      log('ERROR', 'seguimiento_fallido', e.message, c.telefono);
      c.seguimiento_enviado = `error ${ahoraISO()}`; // no reintenta en cada ciclo
    }
    await registrarConversacion(registros);
    await guardarCliente(c);
  }
  return { enviados };
}
