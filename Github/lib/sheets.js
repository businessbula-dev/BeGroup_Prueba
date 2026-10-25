// Acceso a la planilla Agente_BeGroup a través del Apps Script "puente" (apps-script/Codigo.gs),
// publicado como aplicación web dentro de la misma planilla.
// Para que el bot responda rápido, cada mensaje usa 1 llamada para leer todo lo que necesita
// (cargarContexto) y 1 llamada para guardar todo al final (guardarTodo).
import { env } from './config.js';
import { CONFIG_DEFECTO, MENSAJES_DEFECTO, MENSAJES_DEFECTO_EMOJIS, estiloDe } from './seed.js';
import { sinTildes } from './util.js';

export const VERSION_PUENTE = 1;

// Pestañas técnicas que maneja el bot. El orden de las columnas importa: no reordenarlas.
// Todas las DEMÁS pestañas de la planilla (Léeme, Empresa, Productos, Precios, Preguntas frecuentes,
// Derivación, etc.) son de BE Group y el bot las lee como base de conocimiento.
export const HOJAS = {
  Mensajes: ['clave', 'mensaje', 'descripcion'],
  Configuracion: ['clave', 'valor', 'descripcion'],
  Clientes: [
    'telefono', 'nombre_perfil', 'primer_contacto', 'ultimo_mensaje_cliente', 'estado',
    'modelo_interes', 'bienvenida_enviada', 'seguimiento_enviado', 'pausado_hasta',
    'contacto_nombre', 'contacto_telefono', 'contacto_horario', 'alerta_enviada', 'resumen',
    'email', 'comuna_region', 'tipo_uso', 'cantidad', 'plazo_proyecto', 'motivo_derivacion',
    'resultado', 'resultado_fecha', 'resultado_detalle',
  ],
  Conversaciones: ['fecha', 'telefono', 'autor', 'tipo', 'texto', 'wa_id'],
  Logs: ['fecha', 'nivel', 'evento', 'telefono', 'detalle'],
};
export const HOJA_PREGUNTAS = 'Preguntas frecuentes';
const DE_REGISTRO = ['Clientes', 'Conversaciones', 'Logs']; // no son conocimiento
const HISTORIAL_FILAS = 500; // últimas filas de Conversaciones que se leen por mensaje

export let versionPuente = null;

// Envía una lista de operaciones al Apps Script y devuelve sus resultados en el mismo orden.
export async function puente(ops) {
  const url = env('APPS_SCRIPT_URL');
  const clave = env('APPS_SCRIPT_CLAVE');
  if (!url) throw new Error('Falta la variable APPS_SCRIPT_URL');
  if (!clave) throw new Error('Falta la variable APPS_SCRIPT_CLAVE');
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave, ops }),
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new Error('El Apps Script de la planilla no respondió en 25 segundos');
    throw new Error(`No se pudo conectar con el Apps Script: ${e.message}`);
  }
  const texto = await r.text();
  let d;
  try {
    d = JSON.parse(texto);
  } catch {
    throw new Error(`El Apps Script no respondió como se esperaba (HTTP ${r.status}). Revisa que esté implementado como "Aplicación web", con acceso "Cualquier usuario", y que APPS_SCRIPT_URL termine en /exec.`);
  }
  versionPuente = d.version ?? null;
  if (!d.ok) {
    const pista = /clave/i.test(d.error || '') ? ' (APPS_SCRIPT_CLAVE en Vercel debe ser igual a CLAVE en el script)' : '';
    throw new Error(`Apps Script: ${d.error}${pista}`);
  }
  return d.resultados;
}

const una = async (op) => (await puente([op]))[0];

export const metadatos = () => una({ op: 'meta' });
export const leer = (hoja, { ultimas } = {}) => una({ op: 'leer', hoja, ultimas });
export const escribir = (hoja, fila, filas) => una({ op: 'escribir', hoja, fila, filas });
export async function agregar(hoja, filas) {
  if (!filas.length) return null;
  return (await una({ op: 'agregar', hoja, filas })).fila;
}

const aObjeto = (columnas, fila) => Object.fromEntries(columnas.map((c, i) => [c, fila[i] === undefined ? '' : String(fila[i])]));

// ---------- Contenido editable por BE Group (con caché de 60 s) ----------

// Filas que BE Group marcó como pendientes: el bot no las usa.
const RE_PENDIENTE = /^(por confirmar|pendiente)/i;

function tablaATexto(hoja, filas) {
  const [encabezado = [], ...resto] = filas;
  const lineas = [];
  let omitidas = 0;
  // En la pestaña Precios solo se usan las filas con Estado = Vigente (regla de la hoja Léeme).
  const colEstado = sinTildes(hoja) === 'precios' ? encabezado.findIndex((e) => sinTildes(e) === 'estado') : -1;
  for (const fila of resto) {
    const celdas = fila.map((x) => String(x ?? '').trim());
    if (!celdas.some(Boolean)) continue;
    if (celdas.some((c) => RE_PENDIENTE.test(c))) { omitidas += 1; continue; }
    if (colEstado >= 0 && celdas[0] && celdas.filter(Boolean).length > 1 && sinTildes(celdas[colEstado]) !== 'vigente') { omitidas += 1; continue; }
    const partes = celdas.map((v, i) => {
      if (!v) return null;
      const titulo = String(encabezado[i] ?? '').trim();
      return titulo ? `${titulo}: ${v}` : v;
    }).filter(Boolean);
    lineas.push(`- ${partes.join(' | ')}`);
  }
  return { hoja, texto: `### ${hoja}\n${lineas.join('\n')}`, filas: lineas.length, omitidas };
}

function armarContenido({ titulo, hojas, orden }) {
  const config = { ...CONFIG_DEFECTO };
  for (const fila of (hojas.Configuracion || []).slice(1)) {
    const clave = String(fila[0] || '').trim();
    if (clave && fila[1] !== undefined && String(fila[1]).trim() !== '') config[clave] = String(fila[1]).trim();
  }
  config.estilo = estiloDe(config.estilo);
  // Si falta una fila en Mensajes, se usa el texto por defecto del estilo elegido.
  const mensajes = { ...(config.estilo === 'emojis' ? MENSAJES_DEFECTO_EMOJIS : MENSAJES_DEFECTO) };
  for (const fila of (hojas.Mensajes || []).slice(1)) {
    const clave = String(fila[0] || '').trim();
    if (clave) mensajes[clave] = String(fila[1] ?? '').trim();
  }
  let reglas = '';
  const conocimiento = [];
  for (const hoja of orden || Object.keys(hojas)) {
    if (hoja === 'Mensajes' || hoja === 'Configuracion') continue;
    const t = tablaATexto(hoja, hojas[hoja] || []);
    if (sinTildes(hoja) === 'leeme') reglas = t.texto;
    else if (t.filas) conocimiento.push(t);
  }
  return { mensajes, config, conocimiento, reglas, titulo };
}

const opContenido = () => ({ op: 'leerTodas', excluir: DE_REGISTRO });
let cacheContenido = null;

export async function contenido({ fresco = false } = {}) {
  if (!fresco && cacheContenido && Date.now() - cacheContenido.t < 60_000) return cacheContenido.v;
  const v = armarContenido(await una(opContenido()));
  cacheContenido = { t: Date.now(), v };
  return v;
}

// ---------- Clientes ----------

const filasAClientes = (filas) => (filas || []).slice(1)
  .map((f, i) => ({ fila: i + 2, ...aObjeto(HOJAS.Clientes, f) }))
  .filter((c) => c.telefono);

export function buscarEn(clientes, telefono) {
  const t = String(telefono).trim();
  const digitos = t.replace(/\D/g, '');
  return clientes.find((c) => c.telefono.trim() === t)
    // por si alguien editó el número a mano con espacios o +
    || (digitos ? clientes.find((c) => !/[a-z]/i.test(c.telefono) && c.telefono.replace(/\D/g, '') === digitos) : null)
    || null;
}

export const leerClientes = async () => filasAClientes(await leer('Clientes'));
export const buscarCliente = async (telefono) => buscarEn(await leerClientes(), telefono);

// La fila se busca por teléfono dentro del Apps Script (con candado), no por número de fila.
const opGuardarCliente = (c) => ({ op: 'upsert', hoja: 'Clientes', valor: c.telefono, fila: HOJAS.Clientes.map((k) => c[k] ?? '') });

export async function guardarCliente(cliente) {
  cliente.fila = (await una(opGuardarCliente(cliente))).fila;
}

// ---------- Conversaciones ----------

const filasAConversaciones = (filas) => (filas || []).slice(1).map((f) => aObjeto(HOJAS.Conversaciones, f));
const opRegistrar = (registros) => ({
  op: 'agregar',
  hoja: 'Conversaciones',
  filas: registros.map((r) => HOJAS.Conversaciones.map((k) => String(r[k] ?? '').slice(0, 45000))),
});

export const leerConversaciones = async () => filasAConversaciones(await leer('Conversaciones', { ultimas: HISTORIAL_FILAS }));
export async function registrarConversacion(registros) {
  if (registros.length) await una(opRegistrar(registros));
}

// ---------- Una lectura y una escritura por mensaje ----------

export async function cargarContexto() {
  const [todas, conversaciones, clientes] = await puente([
    opContenido(),
    { op: 'leer', hoja: 'Conversaciones', ultimas: HISTORIAL_FILAS },
    { op: 'leer', hoja: 'Clientes' },
  ]);
  const cont = armarContenido(todas);
  cacheContenido = { t: Date.now(), v: cont };
  return { cont, conversaciones: filasAConversaciones(conversaciones), clientes: filasAClientes(clientes) };
}

export async function guardarTodo({ registros = [], cliente = null, logs = [] }) {
  const ops = [];
  if (registros.length) ops.push(opRegistrar(registros));
  if (cliente) ops.push(opGuardarCliente(cliente));
  if (logs.length) ops.push({ op: 'agregar', hoja: 'Logs', filas: logs });
  if (!ops.length) return;
  const res = await puente(ops);
  if (cliente) cliente.fila = res[registros.length ? 1 : 0].fila;
}
