// Control estricto: una respuesta de la IA solo se envía si cada monto y porcentaje
// que menciona aparece textualmente en la planilla. Si no, se bloquea y se deriva.

const RE_MONTO = /\$\s?\d{1,3}(?:[.,]\d{3})+(?!\d)|\$\s?\d+|\b\d{1,3}(?:\.\d{3})+(?!\d)/g;
const RE_PORCENTAJE = /(\d{1,3}(?:[.,]\d+)?)\s?%/g;

const soloDigitos = (s) => s.replace(/\D/g, '');

export function montos(texto) {
  return [...String(texto || '').matchAll(RE_MONTO)].map((m) => soloDigitos(m[0])).filter(Boolean);
}

// Solo montos escritos con signo $ (para comparar Mensajes contra Precios sin confundir "130.000 unidades").
export function montosConSigno(texto) {
  return [...String(texto || '').matchAll(/\$\s?\d{1,3}(?:[.,]\d{3})+(?!\d)|\$\s?\d+/g)].map((m) => soloDigitos(m[0]));
}

export function porcentajes(texto) {
  return [...String(texto || '').matchAll(RE_PORCENTAJE)].map((m) => m[1].replace(',', '.'));
}

export function validarRespuesta(respuesta, fuente) {
  const montosOk = new Set(montos(fuente));
  const pctOk = new Set(porcentajes(fuente));
  const problemas = [
    ...montos(respuesta).filter((m) => !montosOk.has(m)).map((m) => `monto ${m}`),
    ...porcentajes(respuesta).filter((p) => !pctOk.has(p)).map((p) => `porcentaje ${p}%`),
  ];
  return { ok: problemas.length === 0, problemas };
}
