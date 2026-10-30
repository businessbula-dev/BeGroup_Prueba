// API del panel de control (public/index.html). Todo protegido con PANEL_PASSWORD.
import { waitUntil } from '@vercel/functions';
import { env, revisarVariables } from '../lib/config.js';
import { HOJAS, VERSION_PUENTE, metadatos, leer, leerClientes, buscarCliente, contenido, versionPuente, puente } from '../lib/sheets.js';
import { calcularMetricas } from '../lib/metricas.js';
import { infoGemini, probarVelocidad } from '../lib/gemini.js';
import { infoNumero } from '../lib/whatsapp.js';
import { enviarTelegram, telegramConfigurado, infoTelegram, chatsRecientes, conectarWebhookTelegram, infoWebhookTelegram } from '../lib/telegram.js';
import { procesarMensajeCliente, reactivarBot, marcarResultado, pedidoDePrueba, pausarPorRespuestaHumana } from '../lib/bot.js';
import { inicializarPlanilla, reemplazarMensajes, cambiarEstilo } from '../lib/inicializar.js';
import { log, guardarLogs } from '../lib/log.js';
import { rolDe, rolPorClave, crearSesion, puede } from '../lib/sesion.js';
import { opcionesRegistro, verificarRegistro, opcionesIngreso, verificarIngreso, listarAccesos, quitarAcceso } from '../lib/accesos.js';
import { pushConfigurado, generarClavesPush, guardarSuscripcion, quitarSuscripcion, notificar, dispositivosActivos } from '../lib/push.js';
import { enviarTexto, registrarNumero } from '../lib/whatsapp.js';
import { montos, montosConSigno } from '../lib/validar.js';
import { ahoraISO, aMilisegundos, esperar, json, telefonoLegible } from '../lib/util.js';

const VERSION = '1.0.0';

function sinClave() {
  if (!env('PANEL_PASSWORD')) return json({ error: 'Falta configurar PANEL_PASSWORD en Vercel' }, 503);
  return json({ error: 'La sesión venció o la clave no es correcta. Vuelve a entrar.' }, 401);
}
const sinPermiso = () => json({ error: 'Esta sección es solo para el perfil Desarrollador' }, 403);
const dispositivoDe = (request, texto) => String(texto || request.headers.get('user-agent') || '').slice(0, 120);

// Acciones que no necesitan sesión: entrar con clave o con Face ID / huella.
async function accionPublica(request, cuerpo) {
  switch (cuerpo.accion) {
    case 'login': {
      if (!env('PANEL_PASSWORD')) return sinClave();
      const rolPedido = cuerpo.rol === 'dueno' ? 'dueno' : 'desarrollador';
      if (rolPedido === 'dueno' && !env('PANEL_PASSWORD_DUENO')) return json({ error: 'Falta configurar PANEL_PASSWORD_DUENO en Vercel (la clave del dueño).' }, 503);
      const rol = rolPorClave(rolPedido, cuerpo.clave);
      if (!rol) {
        await esperar(600); // frena los intentos de adivinar la clave
        log('WARN', 'ingreso_fallido', `Clave incorrecta para el perfil ${rolPedido === 'dueno' ? 'Dueño' : 'Desarrollador'}`);
        return json({ error: 'Clave incorrecta' }, 401);
      }
      return json({ token: crearSesion(rol), rol });
    }
    case 'acceso_opciones':
      return json(await opcionesIngreso(request, cuerpo.credencial));
    case 'acceso_verificar': {
      try {
        const r = await verificarIngreso(request, cuerpo);
        log('INFO', 'ingreso_biometrico', `Perfil ${r.rol === 'dueno' ? 'Dueño' : 'Desarrollador'} entró con Face ID / huella`);
        return json(r);
      } catch (e) {
        log('WARN', 'ingreso_biometrico_fallido', e.message);
        return json({ error: e.message }, 401);
      }
    }
    default:
      return null;
  }
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
      const desfasados = [...new Set(montosConSigno(Object.values(c.mensajesEstilos).flatMap((m) => Object.values(m)).join('\n')))].filter((m) => !enConocimiento.has(m));
      if (desfasados.length) {
        return { ok: false, detalle: `Mensajes o Mensajes emojis tienen montos que no están en Precios ni en otra pestaña de BE Group: ${desfasados.map((m) => `$${Number(m).toLocaleString('es-CL')}`).join(', ')}. Revisa si un precio cambió.` };
      }
      return {
        ok: c.conocimiento.length > 0,
        detalle: `Planilla "${m.titulo}" (vía Apps Script). Conocimiento: ${c.conocimiento.map((x) => `${x.hoja} (${x.filas})`).join(', ') || 'ninguna pestaña'}${c.reglas ? ' + reglas de Léeme' : ''}. ${c.preguntas?.length || 0} preguntas frecuentes se responden sin IA.${omitidas ? ` ${omitidas} filas "Por confirmar/Pendiente" no se usan.` : ''}`,
      };
    }),
    chequeo('Gemini', async () => ({ detalle: `Modelo ${await infoGemini()}` })),
    chequeo('WhatsApp', async () => {
      const n = await infoNumero();
      return { detalle: `${n.display_phone_number} · ${n.verified_name || 'sin nombre'} · calidad ${n.quality_rating || '—'}` };
    }),
    chequeo('Notificaciones', async () => {
      if (!pushConfigurado()) return { ok: false, detalle: 'Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY: usa "Generar claves de notificación".' };
      const n = (await dispositivosActivos()).length;
      return { ok: n > 0, detalle: n ? `${n} celular(es) reciben avisos` : 'Ningún celular activado todavía: abre la app de chats en el celular y toca "Activar notificaciones".' };
    }),
    chequeo('Telegram', async () => {
      if (!telegramConfigurado() && !env('TELEGRAM_BOT_TOKEN')) return { detalle: 'No configurado (opcional): los avisos llegan a la app de chats.' };
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

// ---------- App de chats ----------

const objetos = (filas, cols) => (filas || []).slice(1).map((f) => Object.fromEntries(cols.map((c, i) => [c, f[i] ?? ''])));
const HORAS_VENTANA = 24;
const nombreDe = (c) => c.contacto_nombre || c.nombre_perfil || telefonoLegible(c.telefono);

function resumenCliente(c, ahora = Date.now()) {
  const ultimoCliente = aMilisegundos(c.ultimo_mensaje_cliente);
  const pausa = aMilisegundos(c.pausado_hasta);
  return {
    telefono: c.telefono,
    nombre: nombreDe(c),
    nombre_perfil: c.nombre_perfil,
    telefonoLegible: telefonoLegible(c.telefono),
    simulador: /^SIM-/i.test(c.telefono),
    estado: c.estado,
    modelo: c.modelo_interes,
    resultado: c.resultado,
    resumen: c.resumen,
    motivo: c.motivo_derivacion,
    contacto: { nombre: c.contacto_nombre, telefono: c.contacto_telefono, horario: c.contacto_horario },
    pausadoHasta: pausa && pausa > ahora ? c.pausado_hasta : '',
    ventanaAbierta: !!ultimoCliente && ahora - ultimoCliente < HORAS_VENTANA * 3600 * 1000,
    ultimoCliente: c.ultimo_mensaje_cliente,
  };
}

async function vistaChats() {
  const [cli, conv] = await puente([
    { op: 'leer', hoja: 'Clientes' },
    { op: 'leer', hoja: 'Conversaciones', ultimas: 3000 },
  ]);
  const ultimo = {};
  for (const m of objetos(conv, HOJAS.Conversaciones)) if (m.telefono) ultimo[m.telefono] = m;
  const ahora = Date.now();
  const chats = objetos(cli, HOJAS.Clientes).filter((c) => c.telefono).map((c) => {
    const u = ultimo[c.telefono];
    const r = resumenCliente(c, ahora);
    r.ultimo = u ? { fecha: u.fecha, autor: u.autor, tipo: u.tipo, texto: String(u.texto).slice(0, 160) } : { fecha: c.ultimo_mensaje_cliente, autor: 'cliente', texto: '' };
    r.porLlamar = c.estado === 'derivado' && !c.resultado;
    r.pidiendoPersona = c.estado === 'pidiendo_datos';
    r.sinResponder = u?.autor === 'cliente' && ahora - (aMilisegundos(u.fecha) || ahora) > 2 * 60 * 1000;
    return r;
  });
  chats.sort((a, b) => (aMilisegundos(b.ultimo.fecha) || 0) - (aMilisegundos(a.ultimo.fecha) || 0));
  return { chats, hora: ahoraISO() };
}

async function vistaChat(telefono, ultimas) {
  const [cli, conv] = await puente([
    { op: 'leer', hoja: 'Clientes' },
    { op: 'leer', hoja: 'Conversaciones', ultimas },
  ]);
  const c = objetos(cli, HOJAS.Clientes).find((x) => x.telefono === telefono);
  if (!c) return null;
  const cont = await contenido();
  return {
    cliente: resumenCliente(c),
    horasPausa: Number(cont.config.horas_pausa_humano) || 12,
    mensajes: objetos(conv, HOJAS.Conversaciones).filter((m) => m.telefono === telefono)
      .map(({ fecha, autor, tipo, texto, wa_id: id }) => ({ fecha, autor, tipo, texto, id })),
  };
}

// Carla responde desde la app: se envía por WhatsApp y el bot se pausa en ese chat.
async function responderChat(telefono, texto) {
  const c = await buscarCliente(telefono);
  if (!c) return { status: 404, error: 'Cliente no encontrado' };
  let id;
  if (/^SIM-/i.test(telefono)) {
    id = `sim-persona-${Date.now()}`; // chat del simulador: no se envía por WhatsApp
  } else {
    try {
      id = await enviarTexto(telefono, texto);
    } catch (e) {
      log('ERROR', 'respuesta_app_fallida', e.message, telefono);
      return {
        status: 409,
        error: e.codigo === 131047
          ? `No se envió: pasaron más de ${HORAS_VENTANA} horas desde el último mensaje de ${nombreDe(c)} y WhatsApp no permite escribirle hasta que vuelva a escribir. Puedes llamarlo.`
          : `No se pudo enviar: ${e.message}`,
      };
    }
  }
  const { horas } = await pausarPorRespuestaHumana({ telefono, id, texto, autor: 'persona', tipo: 'app' });
  log('INFO', 'respuesta_desde_app', `Respondió una persona desde la app; bot en pausa ${horas} h en este chat`, telefono);
  return { ok: true, horas, mensaje: { fecha: ahoraISO(), autor: 'persona', tipo: 'app', texto, id } };
}

const ultimas = (filas, columnas, n) => filas.slice(1).slice(-n).reverse()
  .map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i] ?? ''])));

export async function GET(request) {
  const rol = rolDe(request);
  if (!rol) return sinClave();
  const vista = new URL(request.url).searchParams.get('vista') || 'estado';
  if (!puede(rol, 'vistas', vista)) return sinPermiso();
  try {
    if (vista === 'sesion') return json({ rol, duenoConfigurado: !!env('PANEL_PASSWORD_DUENO') });
    if (vista === 'accesos') return json({ accesos: await listarAccesos(rol) });
    if (vista === 'estado') return json(await estado(request));
    if (vista === 'chats') return json(await vistaChats());
    if (vista === 'chat') {
      const p = new URL(request.url).searchParams;
      const d = await vistaChat(String(p.get('telefono') || ''), Math.min(5000, Math.max(50, Number(p.get('ultimas')) || 5000)));
      return d ? json(d) : json({ error: 'Chat no encontrado' }, 404);
    }
    if (vista === 'push') return json({ configurado: pushConfigurado(), clavePublica: env('VAPID_PUBLIC_KEY') || '' });
    if (vista === 'logs') return json({ filas: ultimas(await leer('Logs', { ultimas: 400 }), HOJAS.Logs, 400) });
    if (vista === 'conversaciones') return json({ filas: ultimas(await leer('Conversaciones', { ultimas: 300 }), HOJAS.Conversaciones, 300) });
    if (vista === 'clientes') return json({ filas: (await leerClientes()).reverse() });
    if (vista === 'metricas') {
      const [cli, conv, lg] = await puente([
        { op: 'leer', hoja: 'Clientes' },
        { op: 'leer', hoja: 'Conversaciones', ultimas: 3000 },
        { op: 'leer', hoja: 'Logs', ultimas: 2000 },
      ]);
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
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* vacío */ }
  try {
    const publica = await accionPublica(request, cuerpo);
    if (publica) return publica;
  } catch (e) {
    return json({ error: e.message }, 500);
  } finally {
    waitUntil(guardarLogs());
  }
  const rol = rolDe(request);
  if (!rol) return sinClave();
  if (!puede(rol, 'acciones', cuerpo.accion)) return sinPermiso();
  try {
    switch (cuerpo.accion) {
      case 'acceso_registro_opciones':
        return json(await opcionesRegistro(request, rol));
      case 'acceso_registro_verificar': {
        const r = await verificarRegistro(request, rol, { ...cuerpo, dispositivo: dispositivoDe(request, cuerpo.dispositivo) });
        log('INFO', 'biometrico_activado', `Perfil ${rol === 'dueno' ? 'Dueño' : 'Desarrollador'}: ${dispositivoDe(request, cuerpo.dispositivo)}`);
        return json({ ok: true, ...r });
      }
      case 'acceso_quitar':
        return json({ ok: await quitarAcceso(String(cuerpo.credencial || ''), rol) });
      case 'inicializar': {
        const r = await inicializarPlanilla();
        log('INFO', 'planilla_inicializada', r.resumen.join(' · '));
        return json(r);
      }
      case 'cambiar_estilo': {
        if (!['formal', 'emojis'].includes(cuerpo.estilo)) return json({ error: 'Estilo inválido' }, 400);
        const r = await cambiarEstilo(cuerpo.estilo);
        await contenido({ fresco: true });
        log('INFO', 'estilo_cambiado', r.resumen.join(' · '));
        return json(r);
      }
      case 'reemplazar_mensajes': {
        const r = await reemplazarMensajes();
        await contenido({ fresco: true });
        log('INFO', 'mensajes_restaurados', r.resumen.join(' · '));
        return json(r);
      }
      case 'probar_alerta': {
        if (!telegramConfigurado()) return json({ error: 'Telegram no está configurado (faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID). Es opcional: los avisos llegan a la app de chats.' }, 400);
        const ok = await enviarTelegram(`✅ Prueba de alerta del agente WhatsApp BE Group (${ahoraISO()}). Si lees esto, las alertas funcionan.`);
        return json({ ok, mensaje: ok ? 'Alerta enviada: revisa Telegram' : 'No se pudo enviar: revisa los logs' });
      }
      case 'probar_gemini': {
        // La misma consulta real a GEMINI_MODEL y al modelo de respaldo, en paralelo, para comparar tiempos.
        const texto = String(cuerpo.texto || '¿Hacen despacho a regiones?').slice(0, 500);
        const resultados = await probarVelocidad(pedidoDePrueba(await contenido(), texto));
        log('INFO', 'gemini_velocidad', resultados.map((x) => `${x.modelo}: ${x.ok ? `${x.segundos} s` : x.error}`).join(' · '));
        return json({ texto, resultados });
      }
      case 'responder_chat': {
        const texto = String(cuerpo.texto || '').trim().slice(0, 4096);
        if (!texto) return json({ error: 'Escribe un mensaje' }, 400);
        const r = await responderChat(String(cuerpo.telefono || ''), texto);
        return r.error ? json({ error: r.error }, r.status) : json(r);
      }
      case 'suscribir_push': {
        if (!pushConfigurado()) return json({ error: 'Faltan las claves de notificación en Vercel (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY).' }, 400);
        await guardarSuscripcion(cuerpo.suscripcion, cuerpo.dispositivo);
        log('INFO', 'notificaciones_activadas', String(cuerpo.dispositivo || 'dispositivo').slice(0, 120));
        return json({ ok: true });
      }
      case 'desuscribir_push':
        await quitarSuscripcion(String(cuerpo.endpoint || ''));
        return json({ ok: true });
      case 'probar_notificacion': {
        if (!pushConfigurado()) return json({ error: 'Faltan las claves de notificación en Vercel: usa "Generar claves de notificación".' }, 400);
        const n = await notificar({ titulo: 'Prueba de notificación · BE Group', cuerpo: 'Si ves esto, los avisos de clientes llegarán a este celular.', etiqueta: 'prueba' });
        return json(n ? { ok: true, mensaje: `Notificación enviada a ${n} celular(es).` } : { error: 'No hay celulares con notificaciones activadas. Abre la app de chats en el celular y toca "Activar notificaciones".' }, n ? 200 : 400);
      }
      case 'registrar_numero': {
        const pin = String(cuerpo.pin || '').trim();
        if (!/^\d{6}$/.test(pin)) return json({ error: 'El PIN debe tener 6 dígitos' }, 400);
        try {
          await registrarNumero(pin);
        } catch (e) {
          log('ERROR', 'registro_numero', e.message);
          const ayuda = e.codigo === 133016 ? ' Se alcanzó el máximo de 10 intentos: Meta bloquea el registro por 72 horas.'
            : e.codigo === 133005 ? ' El PIN no coincide con la verificación en dos pasos que ya tiene el número.' : '';
          return json({ error: `${e.message}.${ayuda}` }, 400);
        }
        log('INFO', 'registro_numero', 'Número registrado en Cloud API');
        return json({ ok: true, mensaje: 'Número registrado en la API. Escribe desde otro celular para probar. Guarda el PIN: es la verificación en dos pasos del número.' });
      }
      case 'generar_claves_push': {
        const k = generarClavesPush();
        return json({ ...k, yaConfigurado: pushConfigurado() });
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
            if (!telegramConfigurado()) return null;
            salida.push(`[Alerta enviada a Telegram]\n${t}`);
            return enviarTelegram(`🧪 PRUEBA DEL SIMULADOR (no es un cliente real)\n\n${t}`);
          },
          // Las notificaciones del simulador sí llegan al celular, marcadas como prueba.
          notificar: async (aviso) => {
            const n = await notificar({ ...aviso, titulo: `🧪 Prueba · ${aviso.titulo}` });
            salida.push(`[Notificación al celular${n ? ` · enviada a ${n}` : ': ningún celular activado'}]\n${aviso.titulo}\n${aviso.cuerpo}`);
            return n;
          },
        };
        // Cada sesión del simulador es un "cliente" distinto (SIM-xxxx); el seguimiento automático los ignora.
        const sesion = /^[a-z0-9]{4,24}$/i.test(cuerpo.sesion || '') ? cuerpo.sesion : 'prueba';
        const r = await procesarMensajeCliente({ telefono: `SIM-${sesion}`, nombre: 'Simulador', id: `sim-in-${Date.now()}`, tipo: 'text', texto }, canal);
        return json({ respuestas: salida, estado: r.cliente?.estado, decision: r.decision || null, error: r.error || null });
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
