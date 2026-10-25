// Gemini con respuesta estructurada (JSON con campos fijos).
//
// Velocidad: se consulta primero GEMINI_MODEL. Si no responde en 18 s (o Google está saturado: 429/500/503),
// se reintenta UNA vez con el modelo rápido (GEMINI_MODEL_RAPIDO, por defecto gemini-3.5-flash-lite con
// razonamiento mínimo), para que el cliente reciba respuesta dentro del límite de 60 s de Vercel.
import { env } from './config.js';
import { esperar } from './util.js';
import { log } from './log.js';

// Si Google retira un modelo, su error sugiere el reemplazo; se recuerda mientras la función siga activa.
let modeloReemplazo = null;

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const MODELO_RAPIDO_DEFECTO = 'gemini-3.5-flash-lite';
const PRESUPUESTO_MS = 42_000; // tiempo total para Gemini dentro de los 60 s de la función
const LIMITE_PRINCIPAL_MS = 18_000;
const LIMITE_RAPIDO_MS = 15_000;

export function modelosConfigurados() {
  const principal = modeloReemplazo || env('GEMINI_MODEL');
  const rapido = String(env('GEMINI_MODEL_RAPIDO') || MODELO_RAPIDO_DEFECTO).trim();
  return { principal, rapido: /^no$/i.test(rapido) || rapido === principal ? null : rapido };
}

// Razonamiento: Gemini 1 y 2 no lo usan (temperatura baja). En Gemini 3+ se pide el nivel más bajo que
// acepta cada modelo ("minimal" en los Flash-Lite, "low" en el resto), porque el nivel por defecto
// (medio o alto) puede tardar demasiado para un chat.
function nivelRazonamiento(modelo) {
  if (/^gemini-(1|2)\./.test(modelo)) return null;
  return /lite/.test(modelo) ? 'minimal' : 'low';
}

function armarCuerpo(modelo, { sistema, usuario, esquema }, ajustes) {
  const cuerpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json' },
  };
  if (esquema && !ajustes.sinEsquema) cuerpo.generationConfig.responseSchema = esquema;
  const nivel = nivelRazonamiento(modelo);
  if (!nivel) cuerpo.generationConfig.temperature = 0.2;
  else if (!ajustes.sinRazonamiento) cuerpo.generationConfig.thinkingConfig = { thinkingLevel: nivel };
  return cuerpo;
}

// Una sola llamada HTTP. Devuelve { ok, status, datos, ms, timeout, error }.
async function llamar(modelo, pedido, ajustes, limiteMs) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
      body: JSON.stringify(armarCuerpo(modelo, pedido, ajustes)),
      signal: AbortSignal.timeout(limiteMs),
    });
    const datos = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, datos, ms: Date.now() - t0 };
  } catch (e) {
    const timeout = e.name === 'TimeoutError' || e.name === 'AbortError';
    return { ok: false, status: 0, datos: {}, ms: Date.now() - t0, timeout, error: timeout ? `no respondió en ${Math.round(limiteMs / 1000)} segundos` : `no se pudo conectar: ${e.message}` };
  }
}

const tokens = (u = {}) => `${u.promptTokenCount ?? '?'} entrada, ${u.candidatesTokenCount ?? '?'} salida, ${u.thoughtsTokenCount ?? 0} razonamiento`;

function extraerJSON(datos) {
  const cand = datos.candidates?.[0];
  const texto = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!texto) throw new Error(`Gemini no devolvió texto (motivo: ${cand?.finishReason || datos.promptFeedback?.blockReason || 'desconocido'})`);
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Gemini devolvió un JSON inválido (motivo: ${cand?.finishReason})`);
  }
}

export async function consultarGemini(pedido) {
  if (!env('GEMINI_API_KEY')) throw new Error('Falta GEMINI_API_KEY');
  const { principal, rapido } = modelosConfigurados();
  let modelo = principal;
  let usandoRapido = false;
  const ajustes = { sinEsquema: false, sinRazonamiento: false };
  const inicio = Date.now();
  let ultimoError;

  const pasarARapido = (motivo) => {
    if (usandoRapido || !rapido) return false;
    log('WARN', 'gemini_lento', `${modelo} ${motivo}; se reintenta con ${rapido}`);
    modelo = rapido;
    usandoRapido = true;
    ajustes.sinRazonamiento = false;
    return true;
  };

  for (let intento = 0; intento < 6; intento += 1) {
    const limite = Math.min(usandoRapido ? LIMITE_RAPIDO_MS : LIMITE_PRINCIPAL_MS, PRESUPUESTO_MS - (Date.now() - inicio));
    if (limite < 4000) break;
    const r = await llamar(modelo, pedido, ajustes, limite);

    if (r.ok) {
      log('INFO', 'gemini_ok', `${modelo} · ${(r.ms / 1000).toFixed(1)} s (total ${((Date.now() - inicio) / 1000).toFixed(1)} s) · tokens: ${tokens(r.datos.usageMetadata)}`);
      return extraerJSON(r.datos);
    }
    const mensaje = r.datos.error?.message || '';
    ultimoError = new Error(`Gemini (${modelo}): ${r.error || mensaje || r.status}`);

    if (r.status === 0) {
      if (pasarARapido(r.error)) continue;
      if (r.timeout) break; // ya no alcanza el tiempo
      await esperar(1000);
      continue;
    }
    // Modelo retirado: el mensaje de Google indica cuál usar ("…use models/gemini-X…").
    const sugerido = /models\/(gemini-[\w.-]+)/.exec(mensaje.replace(`models/${modelo}`, ''))?.[1];
    if ([400, 404].includes(r.status) && /no longer available|not found|deprecated|retired/i.test(mensaje)) {
      if (sugerido && sugerido !== modelo) {
        log('WARN', 'gemini_modelo_reemplazado', `Google retiró ${modelo}; se usa ${sugerido}. Conviene actualizar ${usandoRapido ? 'GEMINI_MODEL_RAPIDO' : 'GEMINI_MODEL'} en Vercel.`);
        if (!usandoRapido) modeloReemplazo = sugerido;
        modelo = sugerido;
        continue;
      }
      if (pasarARapido(`no existe (${mensaje})`)) continue;
      break;
    }
    // Si el modelo no acepta la configuración de razonamiento, se quita y se reintenta.
    if (r.status === 400 && !ajustes.sinRazonamiento && /thinking/i.test(mensaje)) {
      ajustes.sinRazonamiento = true;
      continue;
    }
    // Si el modelo no acepta el esquema de respuesta, se reintenta pidiendo JSON sin esquema.
    if (r.status === 400 && !ajustes.sinEsquema && /schema|response_schema|enum|propertyOrdering|Invalid JSON payload/i.test(mensaje)) {
      ajustes.sinEsquema = true;
      continue;
    }
    if ([429, 500, 503].includes(r.status)) {
      if (pasarARapido(`respondió ${r.status} (${mensaje.slice(0, 120)})`)) continue;
      await esperar(1500);
      continue;
    }
    break;
  }
  throw ultimoError || new Error('Gemini no respondió a tiempo');
}

// Para el botón "Probar velocidad de Gemini" del panel: la misma consulta real a ambos modelos, en paralelo.
export async function probarVelocidad(pedido) {
  if (!env('GEMINI_API_KEY')) throw new Error('Falta GEMINI_API_KEY');
  const { principal, rapido } = modelosConfigurados();
  const modelos = [principal, rapido].filter(Boolean);
  return Promise.all(modelos.map(async (modelo, i) => {
    const r = await llamar(modelo, pedido, { sinEsquema: false, sinRazonamiento: false }, 40_000);
    const fila = { modelo, rol: i === 0 ? 'principal (GEMINI_MODEL)' : 'rápido (respaldo)', segundos: +(r.ms / 1000).toFixed(1), ok: r.ok };
    if (r.ok) {
      const u = r.datos.usageMetadata || {};
      Object.assign(fila, { entrada: u.promptTokenCount, salida: u.candidatesTokenCount, razonamiento: u.thoughtsTokenCount || 0 });
      try { fila.respuesta = extraerJSON(r.datos).respuesta || ''; } catch (e) { fila.respuesta = e.message; }
    } else fila.error = r.error || r.datos.error?.message || `error ${r.status}`;
    return fila;
  }));
}

export async function infoGemini() {
  const { principal, rapido } = modelosConfigurados();
  const r = await fetch(`${BASE}/models/${principal}`, { headers: { 'x-goog-api-key': env('GEMINI_API_KEY') || '' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini: ${d.error?.message || r.status}`);
  return `${d.displayName || d.name}${rapido ? ` · respaldo rápido: ${rapido}` : ''}`;
}
