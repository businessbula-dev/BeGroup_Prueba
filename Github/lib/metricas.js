// Métricas para el dashboard del panel, calculadas desde Clientes, Conversaciones y Logs.
import { aMilisegundos, ahoraISO } from './util.js';

const MODELOS = ['BTW', 'VILLA', 'WKN'];
const MIN_SIN_RESPUESTA = 5 * 60 * 1000; // un mensaje del cliente sin respuesta por más de 5 minutos

const esReal = (c) => /^\d{8,15}$/.test(String(c.telefono || '')); // excluye el simulador
const dia = (iso) => String(iso || '').slice(0, 10);

function mediana(xs) {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const resumenCliente = (c, extra = {}) => ({
  telefono: c.telefono,
  nombre: c.contacto_nombre || c.nombre_perfil || '',
  contacto_telefono: c.contacto_telefono,
  horario: c.contacto_horario,
  modelo: c.modelo_interes,
  estado: c.estado,
  resumen: c.resumen,
  motivo: c.motivo_derivacion,
  ultimo: c.ultimo_mensaje_cliente,
  alerta: c.alerta_enviada,
  ...extra,
});

export function calcularMetricas({ clientes, conversaciones, logs, ahora = Date.now(), dias = 14 }) {
  const reales = clientes.filter(esReal);
  const abiertos = reales.filter((c) => !c.resultado);

  // Último mensaje de cada chat: si es del cliente y nadie respondió, está pendiente.
  const ultimoPorTelefono = new Map();
  for (const m of conversaciones) if (m.telefono) ultimoPorTelefono.set(m.telefono, m);

  const porLlamar = abiertos.filter((c) => c.estado === 'derivado')
    .map((c) => resumenCliente(c)).sort((a, b) => String(a.alerta).localeCompare(String(b.alerta)));
  const datosIncompletos = abiertos.filter((c) => c.estado === 'pidiendo_datos').map((c) => resumenCliente(c));
  const yaListados = new Set([...porLlamar, ...datosIncompletos].map((c) => c.telefono));
  const sinRespuesta = abiertos.filter((c) => !yaListados.has(c.telefono)).map((c) => {
    const u = ultimoPorTelefono.get(c.telefono);
    const t = aMilisegundos(u?.fecha);
    return u && u.autor === 'cliente' && t && ahora - t > MIN_SIN_RESPUESTA ? resumenCliente(c, { mensaje: u.texto }) : null;
  }).filter(Boolean);

  const ventas = reales.filter((c) => c.resultado === 'venta');
  const respondidos = reales.filter((c) => c.estado && c.estado !== 'nuevo');
  const eligieronModelo = reales.filter((c) => c.modelo_interes);
  const pidieronLlamada = reales.filter((c) => c.alerta_enviada);

  // Contactos nuevos por día (hora de Chile), últimos N días.
  const porDia = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const d = ahoraISO(new Date(ahora - i * 86400000)).slice(0, 10); // fecha en hora de Chile
    porDia.push({ dia: d, contactos: reales.filter((c) => dia(c.primer_contacto) === d).length, ventas: ventas.filter((c) => dia(c.resultado_fecha) === d).length });
  }

  const porModelo = [...MODELOS, ''].map((m) => {
    const del = reales.filter((c) => (c.modelo_interes || '') === m);
    const v = del.filter((c) => c.resultado === 'venta').length;
    return { modelo: m || 'Sin definir', interesados: del.length, ventas: v };
  });

  const tiempos = logs.filter((l) => l.evento === 'respondido')
    .map((l) => Number((/salió ([\d.]+) s/.exec(l.detalle) || [])[1]))
    .filter((x) => Number.isFinite(x));

  return {
    totales: {
      contactos: reales.length,
      respondidos: respondidos.length,
      pendientes: porLlamar.length + datosIncompletos.length + sinRespuesta.length,
      ventas: ventas.length,
      perdidos: reales.filter((c) => c.resultado === 'perdido').length,
      conversion: reales.length ? ventas.length / reales.length : 0,
      tiempoMediano: mediana(tiempos.slice(-300)),
      mediciones: Math.min(tiempos.length, 300),
    },
    embudo: [
      { etapa: 'Escribieron', valor: reales.length },
      { etapa: 'Respondidos por el bot', valor: respondidos.length },
      { etapa: 'Eligieron un modelo', valor: eligieronModelo.length },
      { etapa: 'Pidieron que los llamen', valor: pidieronLlamada.length },
      { etapa: 'Venta', valor: ventas.length },
    ],
    porDia,
    porModelo,
    pendientes: { porLlamar, datosIncompletos, sinRespuesta },
  };
}
