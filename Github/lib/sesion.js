// Sesiones del panel: dos perfiles.
//   desarrollador → PANEL_PASSWORD: ve todo el panel.
//   dueno         → PANEL_PASSWORD_DUENO: solo los chats de WhatsApp y el simulador.
// Al entrar (con clave o con Face ID / huella) se entrega un token firmado que el panel envía en cada llamada.
import crypto from 'node:crypto';
import { env } from './config.js';
import { igualesSeguro } from './util.js';

export const ROLES = ['desarrollador', 'dueno'];
const DIAS_SESION = 30;

// La firma depende de las dos claves: si se cambia cualquiera, todas las sesiones abiertas se cierran.
const secreto = () => crypto.createHash('sha256').update(`sesion|${env('PANEL_PASSWORD') || ''}|${env('PANEL_PASSWORD_DUENO') || ''}`).digest();
const firmar = (texto) => crypto.createHmac('sha256', secreto()).update(texto).digest('base64url');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function crearFirmado(datos, segundos) {
  const cuerpo = b64({ ...datos, exp: Math.floor(Date.now() / 1000) + segundos });
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function leerFirmado(token) {
  const [cuerpo, firma] = String(token || '').split('.');
  if (!cuerpo || !firma || !igualesSeguro(firma, firmar(cuerpo))) return null;
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
    return d.exp > Date.now() / 1000 ? d : null;
  } catch {
    return null;
  }
}

export const crearSesion = (rol) => crearFirmado({ tipo: 'sesion', rol }, DIAS_SESION * 86400);

// Rol según la clave escrita, o null.
export function rolPorClave(rol, clave) {
  const c = String(clave || '');
  if (!c) return null;
  if (rol === 'dueno') return env('PANEL_PASSWORD_DUENO') && igualesSeguro(c, env('PANEL_PASSWORD_DUENO')) ? 'dueno' : null;
  return env('PANEL_PASSWORD') && igualesSeguro(c, env('PANEL_PASSWORD')) ? 'desarrollador' : null;
}

// Rol de una llamada al panel: token de sesión (x-sesion) o, por compatibilidad, la clave (x-clave-panel).
export function rolDe(request) {
  const s = leerFirmado(request.headers.get('x-sesion'));
  if (s?.tipo === 'sesion' && ROLES.includes(s.rol)) return s.rol;
  const clave = request.headers.get('x-clave-panel') || '';
  return rolPorClave('desarrollador', clave) || rolPorClave('dueno', clave);
}

// Lo que puede hacer el dueño (todo lo demás es solo para el desarrollador).
export const PERMISOS_DUENO = {
  vistas: ['sesion', 'chats', 'chat', 'push', 'accesos'],
  acciones: ['simular', 'responder_chat', 'reactivar_bot', 'marcar_resultado', 'suscribir_push', 'desuscribir_push',
    'probar_notificacion', 'acceso_registro_opciones', 'acceso_registro_verificar', 'acceso_quitar'],
};
export const puede = (rol, tipo, nombre) => rol === 'desarrollador' || (rol === 'dueno' && PERMISOS_DUENO[tipo].includes(nombre));
