// Gemini con respuesta estructurada (JSON con campos fijos).
import { env } from './config.js';
import { esperar } from './util.js';
import { log } from './log.js';

// Si Google retira un modelo, su error sugiere el reemplazo; se recuerda mientras la función siga activa.
let modeloReemplazo = null;

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function consultarGemini({ sistema, usuario, esquema }) {
  const clave = env('GEMINI_API_KEY');
  if (!clave) throw new Error('Falta GEMINI_API_KEY');
  let modelo = modeloReemplazo || env('GEMINI_MODEL');
  const cuerpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: esquema,
    },
  };
  // Los modelos Gemini 3 o superiores funcionan mejor con su temperatura por defecto.
  if (/^gemini-(1|2)\./.test(modelo)) cuerpo.generationConfig.temperature = 0.2;
  let ultimoError;
  let sinEsquema = false;
  for (let intento = 0; intento < 4; intento += 1) {
    if (sinEsquema) delete cuerpo.generationConfig.responseSchema;
    const r = await fetch(`${BASE}/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify(cuerpo),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const cand = d.candidates?.[0];
      const texto = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      if (!texto) throw new Error(`Gemini no devolvió texto (motivo: ${cand?.finishReason || d.promptFeedback?.blockReason || 'desconocido'})`);
      try {
        return JSON.parse(texto);
      } catch {
        throw new Error(`Gemini devolvió un JSON inválido (motivo: ${cand?.finishReason})`);
      }
    }
    ultimoError = new Error(`Gemini: ${d.error?.message || r.status}`);
    // Modelo retirado: el mensaje de Google indica cuál usar ("…use models/gemini-X…").
    const sugerido = /models\/(gemini-[\w.-]+)/.exec((d.error?.message || '').replace(`models/${modelo}`, ''))?.[1];
    if ([400, 404].includes(r.status) && /no longer available|not found|deprecated|retired/i.test(d.error?.message || '') && sugerido && sugerido !== modelo) {
      log('WARN', 'gemini_modelo_reemplazado', `Google retiró ${modelo}; se usa ${sugerido}. Conviene poner GEMINI_MODEL=${sugerido} en Vercel.`);
      modelo = sugerido;
      modeloReemplazo = sugerido;
      continue;
    }
    // Si el modelo no acepta el esquema de respuesta, se reintenta pidiendo JSON sin esquema.
    if (r.status === 400 && !sinEsquema && /schema|response_schema|enum|propertyOrdering|Invalid JSON payload/i.test(d.error?.message || '')) {
      sinEsquema = true;
      continue;
    }
    if (![429, 500, 503].includes(r.status)) break;
    await esperar(1500);
  }
  throw ultimoError;
}

export async function infoGemini() {
  const r = await fetch(`${BASE}/models/${env('GEMINI_MODEL')}`, { headers: { 'x-goog-api-key': env('GEMINI_API_KEY') || '' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini: ${d.error?.message || r.status}`);
  return d.displayName || d.name;
}
