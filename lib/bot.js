// Lógica del agente: qué responder a cada mensaje.
//
// Flujo (según QA_Wsp_Business_BE_Group.docx):
//  1. Contacto nuevo → mensaje de bienvenida (opciones a, b, c).
//  2. Responde a/b/c → los 3 mensajes del modelo (cómo funciona, videos, precio y plazo).
//  3. No responde → a los X minutos se envía el modelo de seguimiento (Villa). Ver api/seguimiento.js.
//  4. Otras consultas → Gemini, usando SOLO las pestañas de BE Group (Léeme, Productos, Precios,
//     Preguntas frecuentes, Derivación…). Cada monto o porcentaje se valida contra la planilla antes de enviar.
//  5. Pide hablar con una persona (o algo que el bot no sabe) → pide nombre, teléfono y horario,
//     y cuando los tiene envía la alerta por Telegram para que lo llame un ejecutivo.
//  6. Si una persona responde desde la app WhatsApp Business, el bot se calla en ese chat por unas horas.

import { contenido, buscarCliente, guardarCliente, leerConversaciones, cargarContexto, buscarEn, guardarTodo } from './sheets.js';
import { consultarGemini } from './gemini.js';
import { validarRespuesta } from './validar.js';
import { log, tomarLogs, devolverLogs } from './log.js';
import { enviarTelegram, enviarContactoTelegram, alertaTecnica } from './telegram.js';
import { enviarTexto, marcarLeido } from './whatsapp.js';
import { ahoraISO, aMilisegundos, esperar, sinTildes, esSi, rellenar, recortar, telefonoLegible } from './util.js';
import { replicarEnTelegram, lineaReferencia } from './espejo.js';

export const MODELOS = {
  BTW: 'BTW (uso masivo)',
  VILLA: 'Villa (uso familiar/residencial)',
  WKN: 'WKN Prime / Tiny (uso ocasional y móvil)',
};
const OPCION_A_MODELO = { a: 'BTW', b: 'VILLA', c: 'WKN' };

// Canal real: WhatsApp + Telegram. El simulador del panel usa otro canal (ver api/panel.js).
export const canalReal = {
  enviar: enviarTexto,
  marcarLeido,
  alertar: async (texto, cliente) => {
    const conRef = /^\d{8,15}$/.test(String(cliente.telefono)) ? `${texto}\n\n${lineaReferencia(cliente.telefono)}` : texto;
    const ok = await enviarTelegram(conRef);
    if (ok) await enviarContactoTelegram(cliente.telefono, cliente.contacto_nombre || cliente.nombre_perfil);
    return ok;
  },
  replicar: replicarEnTelegram,
};

// ---------- Reglas fijas (no gastan IA) ----------

export function opcionElegida(texto) {
  const m = /^\s*(?:opci[oó]n\s*|la\s+)?\(?([abc])\s*[).:-]?\s*(btw|villa|wkn( prime)?( \/ tiny)?|tiny)?\s*[!.]*\s*$/i.exec(texto || '');
  return m ? OPCION_A_MODELO[m[1].toLowerCase()] : null;
}

export function esAgradecimiento(texto) {
  const t = sinTildes(texto).replace(/[!¡.,👍🙏😊🙌]/gu, ' ').replace(/\s+/g, ' ').trim();
  return /^(ok |listo |perfecto |genial |vale )?(muchas |mil )?gracias( por (la|tu|su) (informacion|info|ayuda|respuesta))?( saludos)?$/.test(t);
}

// ---------- Instrucciones para Gemini ----------

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    accion: {
      type: 'STRING',
      format: 'enum',
      enum: ['responder', 'enviar_modelo', 'pedir_datos', 'sin_info', 'gracias', 'nada'],
      description: 'Qué debe hacer el sistema con el mensaje del cliente.',
    },
    modelo: { type: 'STRING', format: 'enum', enum: ['BTW', 'VILLA', 'WKN', 'NINGUNO'] },
    respuesta: { type: 'STRING', description: 'Texto a enviar al cliente cuando accion=responder, o para pedir datos faltantes.' },
    contacto_nombre: { type: 'STRING', description: 'Nombre que el cliente entregó para que lo llamen, o vacío.' },
    contacto_telefono: { type: 'STRING', description: 'Teléfono que el cliente entregó para que lo llamen, o vacío.' },
    contacto_horario: { type: 'STRING', description: 'Horario o día preferido para la llamada, o vacío.' },
    email: { type: 'STRING', description: 'Email que entregó el cliente, o vacío.' },
    comuna_region: { type: 'STRING', description: 'Comuna o región del cliente o del proyecto, o vacío.' },
    tipo_uso: { type: 'STRING', description: 'Tipo de uso: vivienda, cabaña, parque, camping, minería, camper, etc., o vacío.' },
    cantidad: { type: 'STRING', description: 'Cantidad de usuarios o de unidades, o vacío.' },
    plazo_proyecto: { type: 'STRING', description: 'Plazo del proyecto, o vacío.' },
    motivo_derivacion: { type: 'STRING', description: 'Si se deriva, la situación de la hoja Derivación que aplica (ej. "Negocia precio"), o vacío.' },
    resumen: { type: 'STRING', description: 'Resumen en una línea de lo que el cliente necesita.' },
  },
};
export const CAMPOS_LLAMADA = ['contacto_nombre', 'contacto_telefono', 'contacto_horario'];
export const CAMPOS_CALIFICACION = ['email', 'comuna_region', 'tipo_uso', 'cantidad', 'plazo_proyecto', 'motivo_derivacion'];
ESQUEMA.required = Object.keys(ESQUEMA.properties);
ESQUEMA.propertyOrdering = Object.keys(ESQUEMA.properties);

function informacionOficial({ mensajes, conocimiento }) {
  const bloque = (titulo, claves) => `### ${titulo}\n${claves.map((k) => mensajes[k]).filter(Boolean).join('\n\n')}`;
  return [
    ...conocimiento.map((c) => c.texto),
    '## Mensajes que el sistema envía automáticamente (ya los conoce el cliente si aparecen en el historial)',
    bloque('Mensaje de bienvenida', ['bienvenida']),
    bloque(`a) ${MODELOS.BTW}`, ['BTW_1', 'BTW_2', 'BTW_3']),
    bloque(`b) ${MODELOS.VILLA}`, ['VILLA_1', 'VILLA_2', 'VILLA_3']),
    bloque(`c) ${MODELOS.WKN}`, ['WKN_1', 'WKN_2', 'WKN_3']),
  ].join('\n\n');
}

export function fuenteValidacion(cont) {
  return [...Object.values(cont.mensajes), ...cont.conocimiento.map((c) => c.texto), cont.reglas].join('\n');
}

function instrucciones(cont) {
  return `Eres el asistente virtual de WhatsApp de BE Group, empresa chilena de baños secos. La atención sale a nombre de ${cont.config.nombre_agente}.
Escribes en español de Chile, tuteando, cercano y breve, con pocos emojis, en el formato de WhatsApp (*negrita*).

REGLAS ESTRICTAS
1. Usa SOLO la INFORMACIÓN OFICIAL de abajo. No inventes precios, descuentos, plazos, stock, medidas, datos técnicos, certificaciones, direcciones ni nada que no esté escrito ahí.
2. No calcules montos nuevos (totales por cantidad, cuotas, conversiones, descuentos combinados). Si el cliente pide algo así, usa accion "pedir_datos".
3. Si te preguntan algo que la información oficial no responde, usa accion "sin_info". Es mejor derivar que adivinar.
4. Si el cliente quiere hablar o reunirse con una persona, que lo llamen, negociar el precio, pedir una cotización formal o comprar, usa accion "pedir_datos".
5. Si el cliente elige un modelo (a, b, c, o lo nombra: BTW, Villa, WKN Prime, Tiny, o describe un uso que calza claramente con uno), usa accion "enviar_modelo" con ese modelo. Camper, motorhome o embarcación → WKN. Casa o cabaña familiar → VILLA. Parques, campings o uso masivo → BTW. Si duda entre modelos, usa "responder" y pregunta cuál le interesa.
6. Si el cliente solo agradece o se despide, usa accion "gracias".
7. Si el contacto es nuevo y su mensaje es solo un saludo o un pedido genérico de información (ya recibió la bienvenida con las opciones), usa accion "nada".
8. Para cualquier otra consulta cubierta por la información oficial, usa accion "responder" y escribe la respuesta. Cuando exista una "Respuesta aprobada" en Preguntas frecuentes que aplique, úsala casi textual. Máximo unas 120 palabras.
9. No digas que eres una persona. Si te preguntan si eres un bot o una persona, responde con honestidad que eres el asistente virtual del equipo de ventas y que un ejecutivo puede llamarlo.
10. Si el mensaje no tiene relación con BE Group ni con baños secos, responde amablemente que solo puedes ayudar con los productos de BE Group.
11. Entrega los datos bancarios solo si el cliente pregunta cómo pagar.
12. Las situaciones de la hoja Derivación (cotización formal, negociación, proyectos institucionales, postventa, fechas de entrega específicas, preguntas sin respuesta) se resuelven con accion "pedir_datos", indicando la situación en motivo_derivacion. Si el cliente ya está derivado, puedes seguir respondiendo sus otras dudas.
13. Las REGLAS DE BE GROUP de abajo también son obligatorias.

REGLAS DE BE GROUP (hoja Léeme)
${cont.reglas || '(sin reglas adicionales)'}

DATOS PARA LA LLAMADA
- Cuando el cliente entregue su nombre, teléfono o un horario para que lo llamen (en este mensaje o antes), cópialos en contacto_nombre, contacto_telefono y contacto_horario. Si no los entrega, deja esos campos vacíos.
- Si dice que lo llamen "a este número" o similar, usa el número de WhatsApp del cliente.
- Si el cliente menciona su email, comuna o región, tipo de uso, cantidad de usuarios o unidades, o plazo del proyecto, cópialos en esos campos. Pídelos de forma natural solo cuando ayuden a calificar al cliente, sin interrogarlo.
- Si el ESTADO es "pidiendo_datos" y el cliente responde con sus datos, usa accion "pedir_datos". Si todavía falta alguno de los tres datos, pide amablemente solo lo que falta en "respuesta".
- Si el ESTADO es "pidiendo_datos" pero el cliente hace otra pregunta, respóndela con la acción que corresponda.

INFORMACIÓN OFICIAL
${informacionOficial(cont)}`;
}

function contextoUsuario({ cliente, esNuevo, historial, texto }) {
  const lineas = historial.map((h) => `[${h.autor === 'cliente' ? 'Cliente' : 'BE Group'}] ${recortar(h.texto, 400)}`);
  return `CLIENTE: WhatsApp ${telefonoLegible(cliente.telefono)} · nombre de perfil "${cliente.nombre_perfil || ''}"
ESTADO: ${cliente.estado || 'nuevo'}${esNuevo ? ' (contacto nuevo: se le acaba de enviar el mensaje de bienvenida)' : ''}
MODELO DE INTERÉS: ${cliente.modelo_interes || 'ninguno aún'}
DATOS PARA LA LLAMADA YA REGISTRADOS: nombre="${cliente.contacto_nombre}" teléfono="${cliente.contacto_telefono}" horario="${cliente.contacto_horario}"
OTROS DATOS YA REGISTRADOS: ${CAMPOS_CALIFICACION.map((k) => `${k}="${cliente[k] || ''}"`).join(' ')}

HISTORIAL RECIENTE (más antiguo primero):
${lineas.join('\n') || '(sin mensajes anteriores)'}

MENSAJE NUEVO DEL CLIENTE:
"""${texto}"""`;
}

// ---------- Procesamiento de un mensaje entrante ----------

export async function procesarMensajeCliente(msg, canal = canalReal) {
  const ahora = Date.now();
  let primeraRespuestaMs = null;
  let notaReplica = '';
  const tel = msg.telefono;
  // Una sola llamada a la planilla: contenido, historial reciente y clientes.
  const { cont, conversaciones, clientes } = await cargarContexto();

  if (msg.id && conversaciones.some((c) => c.wa_id === msg.id)) {
    log('INFO', 'mensaje_duplicado', `Meta reenvió ${msg.id}; se ignora`, tel);
    return { duplicado: true };
  }

  let cliente = buscarEn(clientes, tel);
  const esNuevo = !cliente;
  if (esNuevo) {
    cliente = { telefono: tel, primer_contacto: ahoraISO(), estado: 'nuevo' };
    for (const k of [...CAMPOS_LLAMADA, ...CAMPOS_CALIFICACION, 'modelo_interes', 'resumen']) cliente[k] = '';
  }
  if (msg.nombre) cliente.nombre_perfil = msg.nombre;
  cliente.ultimo_mensaje_cliente = ahoraISO();

  const texto = (msg.texto || '').trim();
  const registros = [{ fecha: ahoraISO(), telefono: tel, autor: 'cliente', tipo: msg.tipo, texto: texto || `[${msg.tipo}]`, wa_id: msg.id }];
  const enviados = [];
  let decision = null;

  const pausaEntre = Math.max(0, Number(cont.config.segundos_entre_mensajes) || 0) * 1000;
  const enviar = async (...textos) => {
    for (const t of textos.filter((x) => x && String(x).trim())) {
      if (enviados.length) await esperar(pausaEntre);
      const id = await canal.enviar(tel, t);
      if (primeraRespuestaMs === null) primeraRespuestaMs = Date.now() - ahora;
      enviados.push(t);
      registros.push({ fecha: ahoraISO(), telefono: tel, autor: 'bot', tipo: 'text', texto: t, wa_id: id });
    }
  };
  const enviarModelo = async (modelo) => {
    await enviar(cont.mensajes[`${modelo}_1`], cont.mensajes[`${modelo}_2`], cont.mensajes[`${modelo}_3`]);
    cliente.modelo_interes = modelo;
    cliente.estado = 'modelo_enviado';
    log('INFO', 'modelo_enviado', modelo, tel);
  };

  try {
    if (!esSi(cont.config.bot_activo)) {
      log('INFO', 'bot_apagado', 'bot_activo = no en Configuracion; solo se registra el mensaje', tel);
      notaReplica = '⏸️ Bot apagado: este cliente espera tu respuesta.';
      return { cliente, enviados };
    }
    const pausa = aMilisegundos(cliente.pausado_hasta);
    if (pausa && pausa > ahora) {
      log('INFO', 'bot_en_pausa', `Una persona atiende este chat hasta ${cliente.pausado_hasta}`, tel);
      notaReplica = '⏸️ El bot está en pausa en este chat: respondes tú (o envía /bot como respuesta para reactivarlo).';
      return { cliente, enviados };
    }

    canal.marcarLeido?.(msg.id);
    const opcion = texto ? opcionElegida(texto) : null;

    if (esNuevo && !opcion) {
      await enviar([cont.mensajes.bienvenida, cont.mensajes.aviso_privacidad].filter(Boolean).join('\n\n'));
      cliente.bienvenida_enviada = ahoraISO();
      cliente.estado = 'esperando_modelo';
      log('INFO', 'bienvenida_enviada', '', tel);
    }

    if (!texto) {
      const esArchivo = ['image', 'video', 'document'].includes(msg.tipo);
      await enviar(esArchivo ? cont.mensajes.archivo_recibido : cont.mensajes.solo_texto);
      log('INFO', 'mensaje_no_texto', msg.tipo, tel);
      return { cliente, enviados };
    }
    if (opcion) {
      await enviarModelo(opcion);
      return { cliente, enviados };
    }
    if (esAgradecimiento(texto)) {
      await enviar(cont.mensajes.gracias);
      if (cliente.estado !== 'pidiendo_datos') cliente.estado = cliente.estado === 'derivado' ? 'derivado' : 'conversando';
      return { cliente, enviados };
    }

    // ---- IA ----
    const historial = conversaciones.filter((c) => c.telefono === tel)
      .slice(-(Number(cont.config.mensajes_historial) || 12));
    try {
      decision = await consultarGemini({
        sistema: instrucciones(cont),
        usuario: contextoUsuario({ cliente, esNuevo, historial, texto }),
        esquema: ESQUEMA,
      });
    } catch (e) {
      log('ERROR', 'gemini_error', e.message, tel);
      await enviar(cont.mensajes.error);
      await alertaTecnica('gemini', `No se pudo consultar a Gemini: ${e.message}`);
      await canal.alertar(`🔔 Revisar chat de ${telefonoLegible(tel)}: el bot no pudo responder.\nMensaje: "${recortar(texto, 300)}"\nhttps://wa.me/${tel}`, cliente);
      return { cliente, enviados };
    }
    log('INFO', 'decision_ia', [decision.accion, decision.modelo !== 'NINGUNO' ? decision.modelo : '', recortar(decision.resumen, 200)].filter(Boolean).join(' · '), tel);
    if (decision.resumen) cliente.resumen = recortar(decision.resumen, 300);

    let datosNuevos = false;
    for (const k of CAMPOS_LLAMADA) {
      const v = String(decision[k] || '').trim();
      if (v && v !== cliente[k]) { cliente[k] = recortar(v, 120); datosNuevos = true; }
    }
    for (const k of CAMPOS_CALIFICACION) {
      const v = String(decision[k] || '').trim();
      if (v) cliente[k] = recortar(v, 160);
    }
    const datosCompletos = !!(cliente.contacto_nombre && cliente.contacto_telefono && cliente.contacto_horario);
    const estabaPidiendo = cliente.estado === 'pidiendo_datos';

    const fuente = fuenteValidacion(cont);
    const enviarValidado = async (respuesta) => {
      const v = validarRespuesta(respuesta, fuente);
      if (v.ok) { await enviar(respuesta); return true; }
      log('WARN', 'respuesta_bloqueada', `La IA mencionó ${v.problemas.join(', ')} que no está en la planilla. Texto bloqueado: ${recortar(respuesta, 600)}`, tel);
      return false;
    };

    if (decision.accion === 'pedir_datos' || (estabaPidiendo && datosNuevos)) {
      if (datosCompletos) {
        await derivar({ cliente, cont, canal, enviar, repetido: cliente.estado === 'derivado' && !datosNuevos, actualizado: cliente.estado === 'derivado' && datosNuevos });
      } else {
        const r = String(decision.respuesta || '').trim();
        if ((estabaPidiendo || datosNuevos) && r && await enviarValidado(r)) {
          // ya entregó parte de los datos: se piden solo los que faltan
        } else {
          await enviar(cont.mensajes.pedir_datos);
        }
        cliente.estado = 'pidiendo_datos';
      }
      return { cliente, enviados, decision };
    }

    switch (decision.accion) {
      case 'enviar_modelo':
        if (MODELOS[decision.modelo]) { await enviarModelo(decision.modelo); break; }
      // falls through: modelo no reconocido → se responde como texto
      case 'responder': {
        const r = String(decision.respuesta || '').trim();
        if (r && await enviarValidado(r)) {
          if (!['pidiendo_datos', 'derivado'].includes(cliente.estado)) cliente.estado = 'conversando';
        } else {
          await enviar(cont.mensajes.sin_informacion);
          if (cliente.estado !== 'derivado') cliente.estado = 'pidiendo_datos';
        }
        break;
      }
      case 'sin_info':
        log('INFO', 'sin_informacion', recortar(texto, 300), tel);
        await enviar(cont.mensajes.sin_informacion);
        if (cliente.estado !== 'derivado') cliente.estado = 'pidiendo_datos';
        break;
      case 'gracias':
        await enviar(cont.mensajes.gracias);
        if (!['pidiendo_datos', 'derivado'].includes(cliente.estado)) cliente.estado = 'conversando';
        break;
      case 'nada':
      default:
        // Saludo de un contacto nuevo: la bienvenida ya respondió.
        if (!esNuevo) {
          const r = String(decision.respuesta || '').trim();
          if (r) await enviarValidado(r);
        }
        break;
    }
    return { cliente, enviados, decision };
  } catch (e) {
    log('ERROR', 'error_procesando', e.stack || e.message, tel);
    await alertaTecnica('procesar', `Error procesando un mensaje de ${telefonoLegible(tel)}: ${e.message}`);
    throw e;
  } finally {
    if (enviados.length) log('INFO', 'respondido', `${enviados.length} mensaje(s); el primero salió ${(primeraRespuestaMs / 1000).toFixed(1)} s después de recibir el del cliente`, tel);
    // Siempre se guarda lo que pasó, aunque haya fallado algo en medio: una sola llamada a la planilla.
    const logs = tomarLogs();
    try {
      await guardarTodo({ registros, cliente, logs });
    } catch (e) {
      devolverLogs(logs);
      log('ERROR', 'error_guardando_planilla', e.message, tel);
      await alertaTecnica('planilla', `No se pudo escribir en la planilla: ${e.message}`);
    }
    try {
      await canal.replicar?.(cliente, registros, cont.config, notaReplica);
    } catch (e) {
      log('WARN', 'replica_telegram_error', e.message, tel);
    }
  }
}

async function derivar({ cliente, cont, canal, enviar, repetido, actualizado }) {
  const titulo = repetido ? '🔁 El cliente volvió a pedir que lo llamen'
    : actualizado ? '✏️ El cliente actualizó sus datos para la llamada'
      : '🔔 Nuevo cliente para llamar';
  const etiquetas = { motivo_derivacion: '⚑ Motivo', email: '✉️ Email', comuna_region: '📍 Comuna/región', tipo_uso: '🏠 Uso', cantidad: '🔢 Cantidad', plazo_proyecto: '📅 Plazo del proyecto' };
  const extras = Object.entries(etiquetas).filter(([k]) => cliente[k]).map(([k, e]) => `${e}: ${cliente[k]}`).join('\n');
  const alerta = `${titulo} (BE Group)

👤 Nombre: ${cliente.contacto_nombre}
📞 Teléfono: ${cliente.contacto_telefono}
🕒 Horario: ${cliente.contacto_horario}
💬 WhatsApp: ${telefonoLegible(cliente.telefono)}${cliente.nombre_perfil ? ` (perfil: ${cliente.nombre_perfil})` : ''}
🧩 Modelo de interés: ${cliente.modelo_interes ? MODELOS[cliente.modelo_interes] || cliente.modelo_interes : 'sin definir'}
📝 Consulta: ${cliente.resumen || 'sin resumen'}${extras ? `\n${extras}` : ''}

Abrir chat: https://wa.me/${String(cliente.telefono).replace(/\D/g, '')}`;
  const ok = await canal.alertar(alerta, cliente);
  log(ok ? 'INFO' : 'ERROR', 'alerta_derivacion', ok ? `${cliente.contacto_nombre} · ${cliente.contacto_horario}` : 'No se pudo enviar la alerta por Telegram', cliente.telefono);
  if (repetido) {
    await enviar(cont.mensajes.ya_derivado);
  } else {
    await enviar(rellenar(cont.mensajes.datos_recibidos, {
      nombre: cliente.contacto_nombre, telefono: cliente.contacto_telefono, horario: cliente.contacto_horario,
    }));
  }
  cliente.estado = 'derivado';
  cliente.alerta_enviada = ahoraISO();
}

// ---------- Una persona respondió (desde Telegram, o desde la app si hubiera coexistencia) ----------

export async function pausarPorRespuestaHumana({ telefono, id, tipo = 'text', texto, autor = 'persona' }) {
  const cont = await contenido();
  const horas = Number(cont.config.horas_pausa_humano) || 12;
  let cliente = await buscarCliente(telefono);
  if (!cliente) cliente = { telefono, primer_contacto: ahoraISO(), estado: 'humano', nombre_perfil: '' };
  cliente.pausado_hasta = ahoraISO(new Date(Date.now() + horas * 3600 * 1000));
  cliente.estado = 'humano';
  await guardarTodo({ registros: [{ fecha: ahoraISO(), telefono, autor, tipo, texto: texto || `[${tipo}]`, wa_id: id }], cliente });
  return { cliente, horas };
}

// Resultado comercial del cliente: 'venta', 'perdido' o '' (abierto). Lo marca una persona.
export async function marcarResultado(telefono, resultado, detalle = '') {
  if (!['venta', 'perdido', ''].includes(resultado)) throw new Error('Resultado inválido');
  const cliente = await buscarCliente(telefono);
  if (!cliente) return null;
  cliente.resultado = resultado;
  cliente.resultado_fecha = resultado ? ahoraISO() : '';
  cliente.resultado_detalle = recortar(detalle, 300);
  await guardarCliente(cliente);
  log('INFO', resultado ? `marcado_${resultado}` : 'resultado_borrado', detalle, telefono);
  return cliente;
}

export async function reactivarBot(telefono) {
  const cliente = await buscarCliente(telefono);
  if (!cliente) return null;
  cliente.pausado_hasta = '';
  if (cliente.estado === 'humano') cliente.estado = 'conversando';
  await guardarCliente(cliente);
  return cliente;
}

export async function procesarRespuestaHumana(eco) {
  const conversaciones = await leerConversaciones();
  // Si el eco corresponde a un mensaje que envió el propio bot, se ignora.
  if (eco.id && conversaciones.some((c) => c.wa_id === eco.id)) return;
  const { horas } = await pausarPorRespuestaHumana(eco);
  log('INFO', 'respuesta_humana', `Una persona respondió desde la app; bot en pausa ${horas} h en este chat`, eco.telefono);
}
