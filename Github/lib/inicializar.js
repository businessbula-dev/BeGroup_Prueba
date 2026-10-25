// Crea las pestañas técnicas que falten (Mensajes, Configuracion, Clientes, Conversaciones, Logs),
// carga su contenido inicial SOLO si están vacías y agrega a "Preguntas frecuentes" las preguntas del
// documento de WhatsApp que falten. Nunca borra ni sobrescribe las pestañas de BE Group.
import { HOJAS, HOJA_PREGUNTAS, puente, metadatos, escribir, agregar } from './sheets.js';
import { MENSAJES, CONFIG, FAQ_EXTRA, ESTILOS, estiloDe } from './seed.js';
import { sinTildes } from './util.js';
import { CLAVES_DEFECTO, COLUMNA_CLAVES } from './respuestas-fijas.js';

const INICIAL = { Mensajes: MENSAJES, Configuracion: CONFIG };
const COLUMNA_ANCHA = { Mensajes: 2, Conversaciones: 5 }; // columna de texto largo (1 = A)

// Reescribe la pestaña Mensajes con la versión del código en el estilo indicado ("formal" o "emojis"),
// actualiza las respuestas agregadas desde el documento y guarda el estilo en Configuracion.
// Sin estilo, usa el que ya está elegido. Pierde las ediciones hechas a mano en Mensajes.
export async function reemplazarMensajes(estiloPedido) {
  const [actuales, preguntas, config] = await puente([
    { op: 'leer', hoja: 'Mensajes' },
    { op: 'leer', hoja: HOJA_PREGUNTAS },
    { op: 'leer', hoja: 'Configuracion' },
  ]);
  const filaEstilo = (config || []).find((f, n) => n > 0 && String(f[0]).trim() === 'estilo');
  const estilo = estiloDe(estiloPedido || filaEstilo?.[1]);
  const { nombre, mensajes, faq } = ESTILOS[estilo];

  const sobrantes = Math.max(0, (actuales || []).length - 1 - mensajes.length);
  const ops = [
    { op: 'escribir', hoja: 'Mensajes', fila: 1, filas: [HOJAS.Mensajes, ...mensajes, ...Array.from({ length: sobrantes }, () => ['', '', ''])] },
    { op: 'upsert', hoja: 'Configuracion', valor: 'estilo', fila: CONFIG.find((f) => f[0] === 'estilo').map((v, i) => (i === 1 ? estilo : v)) },
  ];
  // Las preguntas agregadas desde el documento (mismo texto de pregunta) también cambian de estilo.
  const clave = (t) => sinTildes(t).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  let actualizadas = 0;
  for (const extra of faq) {
    const i = (preguntas || []).findIndex((f, n) => n > 0 && clave(f[1]) === clave(extra[1]));
    if (i > 0) { ops.push({ op: 'escribir', hoja: HOJA_PREGUNTAS, fila: i + 1, filas: [extra] }); actualizadas += 1; }
  }
  await puente(ops);
  return {
    estilo,
    resumen: [
      `Forma de responder: ${nombre}`,
      `Mensajes: ${mensajes.length} mensajes reemplazados`,
      ...(actualizadas ? [`${HOJA_PREGUNTAS}: ${actualizadas} respuestas del documento actualizadas`] : []),
    ],
  };
}

export async function inicializarPlanilla() {
  const resumen = [];
  const meta = await metadatos();
  const existentes = new Set(meta.hojas.map((h) => h.titulo));

  const crear = [...Object.keys(HOJAS), HOJA_PREGUNTAS].filter((h) => !existentes.has(h));
  if (crear.length) {
    await puente(crear.map((titulo) => ({ op: 'crearHoja', titulo })));
    resumen.push(`Pestañas creadas: ${crear.join(', ')}`);
  }

  // Una lectura de todas las pestañas involucradas.
  const nombres = [...Object.keys(HOJAS), HOJA_PREGUNTAS];
  const leidas = await puente(nombres.map((hoja) => ({ op: 'leer', hoja, ultimas: 5 })));
  const actuales = Object.fromEntries(nombres.map((h, i) => [h, leidas[i] || []]));

  for (const [hoja, columnas] of Object.entries(HOJAS)) {
    const filas = actuales[hoja];
    if (!(filas[0] || []).some((x) => String(x).trim())) {
      await escribir(hoja, 1, [columnas]);
      resumen.push(`${hoja}: encabezados escritos`);
    }
    if (INICIAL[hoja]) {
      const conDatos = filas.slice(1).filter((f) => f.some((x) => String(x).trim())).length;
      if (conDatos === 0) {
        await escribir(hoja, 2, INICIAL[hoja]);
        resumen.push(`${hoja}: ${INICIAL[hoja].length} filas de contenido inicial cargadas`);
      } else {
        resumen.push(`${hoja}: ya tenía contenido, no se tocó`);
      }
    }
  }
  await puente(Object.keys(HOJAS).map((hoja) => ({ op: 'preparar', hoja, columnaAncha: COLUMNA_ANCHA[hoja] })));
  resumen.push('Formato aplicado a las pestañas técnicas (encabezados en negrita y fijos)');

  // Preguntas del documento de WhatsApp que BE Group todavía no tiene en su pestaña.
  if (!(actuales[HOJA_PREGUNTAS][0] || []).some((x) => String(x).trim())) {
    await escribir(HOJA_PREGUNTAS, 1, [['Tema', 'Pregunta', 'Respuesta aprobada', 'Fuente']]);
  }
  const [preguntas] = await puente([{ op: 'leer', hoja: HOJA_PREGUNTAS }]);
  const clave = (t) => sinTildes(t).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const yaEstan = new Set((preguntas || []).slice(1).map((f) => clave(f[1])));
  const nuevas = FAQ_EXTRA.filter((f) => !yaEstan.has(clave(f[1])));
  if (nuevas.length) {
    await agregar(HOJA_PREGUNTAS, nuevas);
    resumen.push(`${HOJA_PREGUNTAS}: se agregaron ${nuevas.length} preguntas del documento de WhatsApp (${nuevas.map((f) => f[1]).join('; ')})`);
  }

  // Columna "Palabras clave": permite responder esas preguntas sin consultar a la IA.
  // Solo se llenan las celdas vacías; lo que BE Group escriba ahí se respeta.
  const [conClaves] = await puente([{ op: 'leer', hoja: HOJA_PREGUNTAS }]);
  const encabezado = (conClaves || [])[0] || [];
  let col = encabezado.findIndex((e) => sinTildes(e) === sinTildes(COLUMNA_CLAVES));
  const ops = [];
  if (col < 0) {
    col = Math.max(encabezado.length, 4);
    ops.push({ op: 'escribir', hoja: HOJA_PREGUNTAS, fila: 1, columna: col + 1, filas: [[COLUMNA_CLAVES]] });
  }
  (conClaves || []).forEach((f, n) => {
    if (n === 0 || String(f[col] ?? '').trim()) return;
    const claves = CLAVES_DEFECTO.get(clave(f[1]));
    if (claves) ops.push({ op: 'escribir', hoja: HOJA_PREGUNTAS, fila: n + 1, columna: col + 1, filas: [[claves]] });
  });
  if (ops.length) {
    await puente(ops);
    resumen.push(`${HOJA_PREGUNTAS}: palabras clave cargadas en ${ops.filter((o) => o.fila > 1).length} preguntas (se responden sin IA)`);
  }
  return { planilla: meta.titulo, resumen };
}
