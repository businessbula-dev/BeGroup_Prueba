// API del panel de control (public/index.html). Todo protegido con PANEL_PASSWORD.
import { waitUntil } from '@vercel/functions';
import { env, revisarVariables } from '../lib/config.js';
import { HOJAS, VERSION_PUENTE, metadatos, leer, leerClientes, contenido, versionPuente, puente } from '../lib/sheets.js';
import { calcularMetricas } from '../lib/metricas.js';
import { infoGemini } from '../lib/gemini.js';
import { infoNumero } from '../lib/whatsapp.js';
import { enviarTelegram, infoTelegram, chatsRecientes, conectarWebhookTelegram, infoWebhookTelegram } from '../lib/telegram.js';
import { procesarMensajeCliente, reactivarBot, marcarResultado } from '../lib/bot.js';
import { inicializarPlanilla } from '../lib/inicializar.js';
import { log, guardarLogs } from '../lib/log.js';
import { montos, montosConSigno } from '../lib/validar.js';
import { ahoraISO, igualesSeguro, json } from '../lib/util.js';

const VERSION = '1.0.0';

function autorizado(request) {
  const clave = env('PANEL_PASSWORD');
  return !!clave && igualesSeguro(request.headers.get('x-clave-panel') || '', clave);
}

function sinClave() {
  if (!env('PANEL_PASSWORD')) return json({ error: 'Falta configurar PANEL_PASSWORD en Vercel' }, 503);
  return json({ error: 'Clave incorrecta' }, 401);
}

async function chequeo(nombre, fn) {
  const inicio = Date.now();
  try {
    const r = await Promise.race([fn(), new Promise((_, no) => setTimeout(() => no(new Error('sin respuesta en 10 s')), 10_000))]);
    return { nombre, ok: r.ok !== false, detalle: r.detalle, ms: Date.now() - inicio };
  } catch (e) {
    return { nombre, ok: false, detalle: e.message, ms: Date.now() - inicio };
  }
}

async function estado(request) {
  const origen = new URL(request.url).origin;
  const checks = await Promise.all([
    chequeo('Google Sheets', async () => {
      const m = await metadatos();
      if (versionPuente !== VERSION_PUENTE) {
        return { ok: false, detalle: `El Apps Script de la planilla es la versión ${versionPuente}, se espera la ${VERSION_PUENTE}: vuelve a pegar apps-script/Codigo.gs e implementa una nueva versión.` };
      }
      const tabs = m.hojas.map((h) => h.titulo);
      const faltan = Object.keys(HOJAS).filter((h) => !tabs.includes(h));
      if (faltan.length) return { ok: false, detalle: `Planilla "${m.titulo}": faltan pestañas ${faltan.join(', ')}. Usa "Inicializar planilla".` };
      const c = await contenido({ fresco: true });
      const omitidas = c.conocimiento.reduce((n, x) => n + x.omitidas, 0);
      // Montos de la pestaña Mensajes que ya no aparecen en las pestañas de BE Group (precio desactualizado).
      const enConocimiento = new Set(montos(c.conocimiento.map((x) => x.texto).join('\n')));
      const desfasados = [...new Set(montosConSigno(Object.values(c.mensajes).join('\n')))].filter((m) => !enConocimiento.has(m));
      if (desfasados.length) {
        return { ok: false, detalle: `Mensajes tiene montos que no están en Precios ni en otra pestaña de BE Group: ${desfasados.map((m) => `$${Number(m).toLocaleString('es-CL')}`).join(', ')}. Revisa si un precio cambió.` };
      }
      return {
        ok: c.conocimiento.length > 0,
        detalle: `Planilla "${m.titulo}" (vía Apps Script). Conocimiento: ${c.conocimiento.map((x) => `${x.hoja} (${x.filas})`).join(', ') || 'ninguna pestaña'}${c.reglas ? ' + reglas de Léeme' : ''}.${omitidas ? ` ${omitidas} filas "Por confirmar/Pendiente" no se usan.` : ''}`,
      };
    }),
    chequeo('Gemini', async () => ({ detalle: `Modelo ${await infoGemini()}` })),
    chequeo('WhatsApp', async () => {
      const n = await infoNumero();
      return { detalle: `${n.display_phone_number} · ${n.verified_name || 'sin nombre'} · calidad ${n.quality_rating || '—'}` };
    }),
    chequeo('Telegram', async () => {
      const bot = await infoTelegram();
      if (!env('TELEGRAM_CHAT_ID')) return { ok: false, detalle: `Bot ${bot} funciona, pero falta TELEGRAM_CHAT_ID (usa "Buscar chat de Telegram")` };
      const wh = await infoWebhookTelegram();
      const esperado = `${origen}/api/telegram`;
      const respuestas = wh.url === esperado
        ? `respuestas conectadas${wh.last_error_message ? ` (último error: ${wh.last_error_message})` : ''}`
        : 'respuestas por Telegram SIN conectar (usa "Conectar respuestas por Telegram")';
      return { ok: wh.url === esperado && !wh.last_error_message, detalle: `Bot ${bot} → chat ${env('TELEGRAM_CHAT_ID')} · ${respuestas}` };
    }),
  ]);
  let config = null;
  try { config = (await contenido({ fresco: true })).config; } catch { /* la planilla puede no estar lista */ }
  return {
    version: VERSION,
    hora: ahoraISO(),
    variables: revisarVariables(),
    checks,
    urlWebhook: `${origen}/api/webhook`,
    config,
  };
}

const ultimas = (filas, columnas, n) => filas.slice(1).slice(-n).reverse()
  .map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i] ?? ''])));

export async function GET(request) {
  if (!autorizado(request)) return sinClave();
  const vista = new URL(request.url).searchParams.get('vista') || 'estado';
  try {
    if (vista === 'estado') return json(await estado(request));
    if (vista === 'logs') return json({ filas: ultimas(await leer('Logs', { ultimas: 400 }), HOJAS.Logs, 400) });
    if (vista === 'conversaciones') return json({ filas: ultimas(await leer('Conversaciones', { ultimas: 300 }), HOJAS.Conversaciones, 300) });
    if (vista === 'clientes') return json({ filas: (await leerClientes()).reverse() });
    if (vista === 'metricas') {
      const [cli, conv, lg] = await puente([
        { op: 'leer', hoja: 'Clientes' },
        { op: 'leer', hoja: 'Conversaciones', ultimas: 3000 },
        { op: 'leer', hoja: 'Logs', ultimas: 2000 },
      ]);
      const objetos = (filas, cols) => (filas || []).slice(1).map((f) => Object.fromEntries(cols.map((c, i) => [c, f[i] ?? ''])));
      return json(calcularMetricas({
        clientes: objetos(cli, HOJAS.Clientes).filter((c) => c.telefono),
        conversaciones: objetos(conv, HOJAS.Conversaciones),
        logs: objetos(lg, HOJAS.Logs),
      }));
    }
    return json({ error: 'Vista desconocida' }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function POST(request) {
  if (!autorizado(request)) return sinClave();
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* vacío */ }
  try {
    switch (cuerpo.accion) {
      case 'inicializar': {
        const r = await inicializarPlanilla();
        log('INFO', 'planilla_inicializada', r.resumen.join(' · '));
        return json(r);
      }
      case 'probar_alerta': {
        const ok = await enviarTelegram(`✅ Prueba de alerta del agente WhatsApp BE Group (${ahoraISO()}). Si lees esto, las alertas funcionan.`);
        return json({ ok, mensaje: ok ? 'Alerta enviada: revisa Telegram' : 'No se pudo enviar: revisa los logs' });
      }
      case 'chats_telegram':
        return json({ chats: await chatsRecientes() });
      case 'conectar_telegram': {
        if (!env('TELEGRAM_CHAT_ID')) return json({ error: 'Primero configura TELEGRAM_CHAT_ID (usa "Buscar chat de Telegram") y haz Redeploy' }, 400);
        const url = await conectarWebhookTelegram(`${new URL(request.url).origin}/api/telegram`);
        log('INFO', 'telegram_conectado', url);
        await enviarTelegram('✅ Respuestas conectadas. Cuando llegue la copia de un chat de WhatsApp, usa "Responder" sobre ese mensaje y tu texto le llegará al cliente por WhatsApp.');
        return json({ ok: true, mensaje: `Listo: Telegram enviará las respuestas a ${url}` });
      }
      case 'simular': {
        const texto = String(cuerpo.texto || '').slice(0, 2000);
        if (!texto.trim()) return json({ error: 'Escribe un mensaje' }, 400);
        const salida = [];
        const canal = {
          enviar: async (_tel, t) => { salida.push(t); return `sim-${Date.now()}-${salida.length}`; },
          marcarLeido: () => {},
          alertar: async (t) => {
            salida.push(`[Alerta enviada a Telegram]\n${t}`);
            return enviarTelegram(`🧪 PRUEBA DEL SIMULADOR (no es un cliente real)\n\n${t}`);
          },
        };
        // Cada sesión del simulador es un "cliente" distinto (SIM-xxxx); el seguimiento automático los ignora.
        const sesion = /^[a-z0-9]{4,24}$/i.test(cuerpo.sesion || '') ? cuerpo.sesion : 'prueba';
        const r = await procesarMensajeCliente({ telefono: `SIM-${sesion}`, nombre: 'Simulador', id: `sim-in-${Date.now()}`, tipo: 'text', texto }, canal);
        return json({ respuestas: salida, estado: r.cliente?.estado, decision: r.decision || null });
      }
      case 'marcar_resultado': {
        const c = await marcarResultado(String(cuerpo.telefono || ''), String(cuerpo.resultado ?? ''), String(cuerpo.detalle || ''));
        if (!c) return json({ error: 'Cliente no encontrado' }, 404);
        return json({ ok: true });
      }
      case 'reactivar_bot': {
        const c = await reactivarBot(String(cuerpo.telefono || ''));
        if (!c) return json({ error: 'Cliente no encontrado' }, 404);
        log('INFO', 'bot_reactivado', 'Reactivado desde el panel', c.telefono);
        return json({ ok: true, mensaje: 'Bot reactivado en ese chat' });
      }
      default:
        return json({ error: 'Acción desconocida' }, 400);
    }
  } catch (e) {
    log('ERROR', `panel_${cuerpo.accion || 'accion'}`, e.message);
    return json({ error: e.message }, 500);
  } finally {
    waitUntil(guardarLogs());
  }
}
