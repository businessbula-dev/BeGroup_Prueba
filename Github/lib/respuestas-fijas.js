// Respuestas sin IA: si el mensaje del cliente calza con UNA sola pregunta de la pestaña
// "Preguntas frecuentes", se envía su "Respuesta aprobada" tal cual, sin consultar a Gemini.
//
// Cada pregunta tiene "palabras clave" (columna "Palabras clave" de esa pestaña; si está vacía se usan
// las de este archivo). Formato, separado por comas:
//   garantia            → la palabra completa
//   despach*            → cualquier palabra que empiece así (despacho, despachan…)
//   cada cuanto vacia*  → la frase seguida
//   envio* + region*    → ambas, en cualquier parte del mensaje
//   !caseta             → en preguntas de un modelo (Tema = BTW, Villa, WKN Prime o Tiny), basta esta
//                         palabra aunque el cliente no nombre el modelo
// Tildes y mayúsculas dan lo mismo.
//
// Para no equivocarse, si hay duda decide la IA: mensajes largos, con números (fechas, cantidades,
// teléfonos), sobre precios, compras o reclamos, o que calzan con dos o más preguntas.
import { sinTildes } from './util.js';

export const COLUMNA_CLAVES = 'Palabras clave';

// Palabras clave iniciales de las preguntas de BE Group y del documento de WhatsApp (por texto de pregunta).
const CLAVES = [
  ['¿Qué es un baño seco con separación de orina?', 'que es un bano seco, que son los banos secos, que es la separacion de orina, como funciona un bano seco, como funcionan los banos secos'],
  ['¿Necesitan agua o alcantarillado?', 'necesita* agua, usa* agua, ocupa* agua, gasta* agua, consume* agua, alcantarillado, conexion de agua, red de agua'],
  ['¿Hay olores?', 'olor*, hedor*, huele*, hediondo*'],
  ['¿Necesitan electricidad?', 'electricidad, electric*, enchufe*, corriente, energia, luz electrica, panel* solar*, bateria*, consumo electrico'],
  ['¿De dónde son los productos?', 'de donde son, de donde vienen, donde se fabrica*, donde los fabrica*, fabricado* en, quien los fabrica, de que pais, origen, importado*, son chilenos'],
  ['¿Qué garantía tienen?', 'garantia*'],
  ['¿Funcionan con frío o calor?', 'frio, calor, helada*, nieve, bajo cero, invierno, temperatura*'],
  ['¿Qué incluye el BTW? ¿Incluye la caseta?', '!caseta, que incluye, que trae, viene con'],
  ['¿Cuántos usos soporta el BTW?', 'cuantos usos, cuantas personas, cuantos usuarios, capacidad, usos al dia, usos diarios, cuanta gente'],
  ['¿Qué pasa con los sólidos en el BTW?', 'solidos, caca, heces, fecas, excremento*, que pasa con los residuos, compostaje, retiro de'],
  ['¿Cuánta mantención necesita el BTW?', 'mantencion, mantenimiento, mantener, limpieza, limpiar'],
  ['¿Cuánto volumen de residuos genera?', 'volumen, cuanto residuo*, cuantos residuos'],
  ['¿Por qué es mejor que un compostaje con aserrín?', '!aserrin'],
  ['¿Cuál es el plazo de entrega?', 'plazo de entrega, plazo de despacho, cuando llega*, demora* en llegar, tarda* en llegar, cuanto demora* la entrega, cuanto demora* el despacho, tiempo de entrega, cuando lo entregan, cuando me lo entregan, entrega inmediata, tienen stock, hay stock, disponibilidad'],
  ['¿Despachan a regiones?', 'despach*, envian a, hacen envio*, envio a, envios a, envio* + region*, mandan a, llega* a region*, regiones, region, a todo chile, transporte, flete'],
  ['¿Cada cuánto se vacía el Villa?', 'vacia*, vaciar, vaciado, cada cuanto se'],
  ['¿Es difícil de instalar el Villa?', 'dificil de instalar, facil de instalar, como se instala, como instalar*, es dificil la instalacion, cuanto demora la instalacion, se instala'],
  ['¿Cómo controla los olores el WKN Prime?', 'olor*, hedor*, huele*, ventilacion, ducto'],
  ['¿Qué baño recomiendan para camper o motorhome?', 'camper, motorhome, motor home, casa rodante, autocaravana, furgon, embarcacion, bote, velero, lancha'],
  ['¿Necesito autorización sanitaria?', 'seremi, autorizacion sanitaria, resolucion sanitaria, permiso*, normativa, sumario sanitario'],
  ['¿Hay financiamiento?', 'financ*, corfo, subsidio*'],
  ['¿Tienen proyectos funcionando en Chile?', 'proyectos funcionando, proyectos en chile, donde estan instalados, donde los han instalado, referencias, ejemplos, torres del paine, casos de exito'],
  ['Formas de pago / datos de transferencia', 'formas de pago, forma de pago, medios de pago, metodos de pago, como pago, como se paga, como puedo pagar, como les pago, datos bancarios, datos de transferencia, datos para transferir, cuenta bancaria, numero de cuenta, webpay, pagar con tarjeta, aceptan tarjeta*'],
  ['¿Hacen la instalación?', 'hacen la instalacion, hacen instalacion, ustedes instalan, ustedes lo instalan, lo instalan ustedes, quien lo instala, quien instala, incluye instalacion, incluye la instalacion, servicio de instalacion, instalacion incluida'],
  ['¿Dónde se pueden ver los baños?', 'donde se pueden ver, donde los puedo ver, donde lo puedo ver, puedo verlos, puedo verlo, verlo en persona, verlos en persona, showroom, tienen tienda, tienda fisica, tienen oficina, su oficina, tienen local, sala de venta*, visitar*, donde estan ubicados, donde se ubican, cual es la direccion, su direccion'],
];

const clave = (t) => sinTildes(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const CLAVES_DEFECTO = new Map(CLAVES.map(([p, c]) => [clave(p), c]));

// Preguntas con un flujo propio (no se responden con el texto de la pestaña).
const CON_FLUJO_PROPIO = /hablar con una persona|^gracias/;

// Temas que corresponden a un modelo: la pregunta solo aplica si el cliente nombra ese modelo
// (o ya eligió ese modelo y no nombra otro).
const MODELO_DE_TEMA = { btw: 'BTW', villa: 'VILLA', 'wkn prime': 'WKN', wkn: 'WKN', tiny: 'WKN' };
const MODELOS_EN_TEXTO = /\b(btw|villa|wkn prime|wkn|prime|tiny)\b/g;
const modeloDe = (n) => ({ btw: 'BTW', villa: 'VILLA', prime: 'WKN', 'wkn prime': 'WKN', wkn: 'WKN', tiny: 'WKN' }[n]);

// Si el mensaje toca alguno de estos temas, decide la IA (precios, compras, reclamos: derivación).
const DECIDE_IA = /\b(precio\w*|valor\w*|cuesta\w*|vale|valen|cobr\w*|cotiz\w*|descuento\w*|rebaja\w*|oferta\w*|compr\w*|factura\w*|cuota\w*|negoci\w*|falla\w*|fallo|roto|rota|reclamo\w*|devolucion\w*|problema\w*|no funciona)\b/;

const MAX_PALABRAS = 20;

// Solo quedan letras, números, espacios y "*" (comodín al final de una palabra).
const normalizarClave = (p) => sinTildes(p).replace(/[^a-z0-9* ]/g, ' ').replace(/\s+/g, ' ').trim();
const aRegex = (frase) => new RegExp(`\\b${frase.split(' ').map((p) => p.replace(/\*/g, '\\w*')).join('\\s+')}\\b`);

// "envio* + region*, !caseta" → [{ fuerte, partes: [RegExp…] }]
export function leerClaves(texto) {
  return String(texto || '').split(/[,;\n]/).map((alt) => alt.trim()).filter(Boolean).map((alt) => {
    const fuerte = alt.startsWith('!');
    const partes = alt.replace(/^!/, '').split('+').map(normalizarClave).filter(Boolean).map(aRegex);
    return { fuerte, partes };
  }).filter((a) => a.partes.length);
}

// Preguntas frecuentes de la planilla: [{ tema, pregunta, respuesta, claves }]
export function preguntasFrecuentes(filas = []) {
  const [encabezado = [], ...resto] = filas;
  const col = (nombre) => encabezado.findIndex((e) => sinTildes(e) === sinTildes(nombre));
  const iTema = col('Tema');
  const iPregunta = col('Pregunta') >= 0 ? col('Pregunta') : 1;
  const iRespuesta = col('Respuesta aprobada') >= 0 ? col('Respuesta aprobada') : 2;
  const iClaves = col(COLUMNA_CLAVES);
  return resto.filter((f) => !f.some((c) => /^(por confirmar|pendiente)/i.test(String(c ?? '').trim()))).map((f) => {
    const pregunta = String(f[iPregunta] ?? '').trim();
    const respuesta = String(f[iRespuesta] ?? '').trim();
    const propias = iClaves >= 0 ? String(f[iClaves] ?? '').trim() : '';
    return { tema: iTema >= 0 ? String(f[iTema] ?? '').trim() : '', pregunta, respuesta, claves: propias || CLAVES_DEFECTO.get(clave(pregunta)) || '' };
  }).filter((p) => p.pregunta && p.respuesta && p.claves && !CON_FLUJO_PROPIO.test(clave(p.pregunta)));
}

// Devuelve { pregunta, respuesta } si el mensaje calza con UNA sola pregunta frecuente; si no, null.
export function respuestaFija(texto, preguntas, modeloInteres = '') {
  const t = clave(texto);
  if (!t || t.split(' ').length > MAX_PALABRAS || /\d/.test(t) || DECIDE_IA.test(t)) return null;
  const nombrados = new Set([...t.matchAll(MODELOS_EN_TEXTO)].map((m) => modeloDe(m[1])));
  const calzan = preguntas.filter((p) => {
    const modeloTema = MODELO_DE_TEMA[clave(p.tema)];
    const alternativas = leerClaves(p.claves).filter((a) => a.partes.every((re) => re.test(t)));
    if (!alternativas.length) return false;
    if (!modeloTema) return true;
    if (nombrados.size) return nombrados.has(modeloTema);
    return modeloTema === modeloInteres || alternativas.some((a) => a.fuerte);
  });
  const respuestas = [...new Map(calzan.map((p) => [p.respuesta, p])).values()];
  if (respuestas.length !== 1) return null;
  const elegida = respuestas[0];
  const modelo = MODELO_DE_TEMA[clave(elegida.tema)] || '';
  // Si la pregunta es de un modelo y la respuesta no lo nombra, se aclara de cuál se habla.
  const nombra = modelo && /\b(btw|villa|wkn|prime|tiny)\b/.test(clave(elegida.respuesta));
  const respuesta = modelo && !nombra ? `Sobre el ${elegida.tema.replace(/^be group\s+/i, '')}: ${elegida.respuesta}` : elegida.respuesta;
  return { pregunta: elegida.pregunta, respuesta, modelo };
}

// "Quiero hablar con una persona", "que me llamen"… (sin datos todavía: esos los extrae la IA).
export function pideHablarConPersona(texto) {
  const t = clave(texto);
  if (!t || t.split(' ').length > 15 || /\d/.test(t)) return false;
  return /\b(hablar|conversar) con (una |alguna |un |algun )?(persona|ejecutiv\w*|humano|alguien|vendedor\w*|asesor\w*)\b|\b(me|nos) (pueden |puede |podrian |podria )?llam(ar|en|e)\b|\bllam(enme|ame|arme|ennos)\b|\bun ejecutivo\b/.test(t);
}

