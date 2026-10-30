/**
 * Puente entre el agente de WhatsApp (Vercel) y esta planilla.
 *
 * Instalación (una sola vez):
 *  1. En la planilla: Extensiones → Apps Script. Borrar lo que haya y pegar este archivo completo.
 *  2. Cambiar CLAVE por un texto largo inventado (el mismo que va en APPS_SCRIPT_CLAVE en Vercel).
 *  3. Implementar → Nueva implementación → tipo "Aplicación web".
 *     Ejecutar como: "Yo". Quién tiene acceso: "Cualquier usuario". → Implementar → Autorizar.
 *  4. Copiar la URL que termina en /exec y pegarla en APPS_SCRIPT_URL en Vercel.
 *
 * Si se modifica este código: Implementar → Gestionar implementaciones → editar (lápiz) →
 * Versión: "Nueva versión". Así la URL no cambia.
 */
const CLAVE = 'PEGAR_AQUI_LA_MISMA_CLAVE_QUE_EN_VERCEL';
const VERSION = 2;

function doGet() {
  return salida({ ok: true, version: VERSION, mensaje: 'Puente del agente de WhatsApp activo' });
}

function doPost(e) {
  let pedido;
  try {
    pedido = JSON.parse(e.postData.contents);
  } catch (err) {
    return salida({ ok: false, error: 'JSON inválido' });
  }
  if (!CLAVE || CLAVE.indexOf('PEGAR_AQUI') === 0) return salida({ ok: false, error: 'Falta cambiar CLAVE en el Apps Script' });
  if (pedido.clave !== CLAVE) return salida({ ok: false, error: 'Clave incorrecta' });

  const ops = pedido.ops || [];
  const escribe = ops.some(function (o) { return ESCRITURA[o.op]; });
  const candado = LockService.getScriptLock();
  if (escribe) candado.waitLock(25000); // evita que dos mensajes simultáneos pisen la misma fila
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const resultados = ops.map(function (o) {
      if (!OPS[o.op]) throw new Error('Operación desconocida: ' + o.op);
      return OPS[o.op](libro, o);
    });
    if (escribe) SpreadsheetApp.flush();
    return salida({ ok: true, version: VERSION, resultados: resultados });
  } catch (err) {
    return salida({ ok: false, version: VERSION, error: String((err && err.message) || err) });
  } finally {
    if (escribe) candado.releaseLock();
  }
}

function salida(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function hoja(libro, nombre) {
  const h = libro.getSheetByName(nombre);
  if (!h) throw new Error('No existe la pestaña "' + nombre + '" (usa "Inicializar planilla" en el panel)');
  return h;
}

// Valores tal como se ven en la planilla. Con "ultimas" devuelve el encabezado + las últimas N filas.
function valores(h, ultimas) {
  const filas = h.getLastRow();
  const cols = h.getLastColumn();
  if (!filas || !cols) return [];
  if (ultimas && filas > ultimas + 1) {
    return h.getRange(1, 1, 1, cols).getDisplayValues()
      .concat(h.getRange(filas - ultimas + 1, 1, ultimas, cols).getDisplayValues());
  }
  return h.getRange(1, 1, filas, cols).getDisplayValues();
}

// Todo se guarda como texto. Un mensaje que empiece con "=" no se convierte en fórmula.
function comoTexto(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return s.charAt(0) === '=' ? '​' + s : s;
}

function escribirFilas(h, fila, columna, filas) {
  if (!filas || !filas.length) return;
  const ancho = Math.max.apply(null, filas.map(function (f) { return f.length; }));
  const datos = filas.map(function (f) {
    const r = f.map(comoTexto);
    while (r.length < ancho) r.push('');
    return r;
  });
  const rango = h.getRange(fila, columna, datos.length, ancho);
  rango.setNumberFormat('@');
  rango.setValues(datos);
}

const OPS = {
  meta: function (libro) {
    return { titulo: libro.getName(), hojas: libro.getSheets().map(function (h) { return { titulo: h.getName(), id: h.getSheetId() }; }) };
  },
  leer: function (libro, o) {
    return valores(hoja(libro, o.hoja), o.ultimas);
  },
  leerTodas: function (libro, o) {
    const excluir = o.excluir || [];
    const hojas = {};
    const orden = [];
    libro.getSheets().forEach(function (h) {
      if (excluir.indexOf(h.getName()) >= 0) return;
      hojas[h.getName()] = valores(h);
      orden.push(h.getName());
    });
    return { titulo: libro.getName(), hojas: hojas, orden: orden };
  },
  agregar: function (libro, o) {
    const h = hoja(libro, o.hoja);
    const fila = h.getLastRow() + 1;
    escribirFilas(h, fila, 1, o.filas);
    return { fila: fila };
  },
  escribir: function (libro, o) {
    escribirFilas(hoja(libro, o.hoja), o.fila, o.columna || 1, o.filas);
    return true;
  },
  // Actualiza la fila cuya columna A sea "valor", o la agrega al final si no existe.
  upsert: function (libro, o) {
    const h = hoja(libro, o.hoja);
    const n = h.getLastRow();
    let fila = 0;
    if (n > 1) {
      const claves = h.getRange(2, 1, n - 1, 1).getDisplayValues();
      for (let i = 0; i < claves.length; i++) {
        if (String(claves[i][0]).trim() === String(o.valor).trim()) { fila = i + 2; break; }
      }
    }
    if (!fila) fila = Math.max(n, 1) + 1;
    escribirFilas(h, fila, 1, [o.fila]);
    return { fila: fila };
  },
  crearHoja: function (libro, o) {
    if (!libro.getSheetByName(o.titulo)) libro.insertSheet(o.titulo, libro.getSheets().length);
    return true;
  },
  // Borra todas las filas menos el encabezado (por ejemplo, la pestaña Logs).
  vaciar: function (libro, o) {
    const h = hoja(libro, o.hoja);
    const n = h.getLastRow();
    if (n <= 1) return { borradas: 0 };
    asegurarFilaLibre(h, n);
    h.deleteRows(2, n - 1);
    return { borradas: n - 1 };
  },
  // Borra las filas cuya columna "columna" (1 = A) sea igual a alguno de "valores" o empiece con alguno de "prefijos".
  borrarDonde: function (libro, o) {
    const h = hoja(libro, o.hoja);
    const n = h.getLastRow();
    if (n <= 1) return { borradas: 0 };
    const valores = (o.valores || []).map(String);
    const prefijos = (o.prefijos || []).map(String);
    const celdas = h.getRange(2, o.columna || 1, n - 1, 1).getDisplayValues();
    const filas = [];
    celdas.forEach(function (c, i) {
      const v = String(c[0]).trim();
      if (v && (valores.indexOf(v) >= 0 || prefijos.some(function (p) { return v.indexOf(p) === 0; }))) filas.push(i + 2);
    });
    if (!filas.length) return { borradas: 0 };
    asegurarFilaLibre(h, n);
    // De abajo hacia arriba, agrupando filas seguidas.
    for (let i = filas.length - 1; i >= 0;) {
      let fin = filas[i];
      let inicio = fin;
      while (i > 0 && filas[i - 1] === inicio - 1) { i -= 1; inicio -= 1; }
      h.deleteRows(inicio, fin - inicio + 1);
      i -= 1;
    }
    return { borradas: filas.length };
  },
  preparar: function (libro, o) {
    const h = hoja(libro, o.hoja);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).setFontWeight('bold');
    if (o.columnaAncha) {
      h.setColumnWidth(o.columnaAncha, 520);
      h.getRange(2, o.columnaAncha, Math.max(1, h.getMaxRows() - 1), 1).setWrap(true).setVerticalAlignment('top');
    }
    return true;
  },
};

const ESCRITURA = { agregar: true, escribir: true, upsert: true, crearHoja: true, preparar: true, vaciar: true, borrarDonde: true };

// Google no deja borrar todas las filas no fijas de una pestaña: se deja una fila vacía al final.
function asegurarFilaLibre(h, ultima) {
  if (h.getMaxRows() <= ultima) h.insertRowsAfter(ultima, 1);
}
