// Gemini con respuesta estructurada (JSON con campos fijos).
import { env } from './config.js';
import { esperar } from './util.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function consultarGemini({ sistema, usuario, esquema }) {
  const clave = env('GEMINI_API_KEY');
  if (!clave) throw new Error('Falta GEMINI_API_KEY');
  const modelo = env('GEMINI_MODEL');
  const cuerpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: esquema,
    },
  };
  let ultimoError;
  for (let intento = 0; intento < 2; intento += 1) {
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
