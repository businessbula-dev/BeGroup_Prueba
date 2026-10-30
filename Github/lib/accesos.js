// Ingreso con Face ID (iPhone) o huella / reconocimiento facial (Android, Samsung) usando "llaves de acceso"
// (passkeys, estándar WebAuthn). El celular guarda la llave privada y solo la usa después de verificar la cara
// o la huella; aquí se guarda la llave pública de cada celular en la pestaña "Accesos" de la planilla.
// Los desafíos van firmados (no se guardan): duran 5 minutos.
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { puente, HOJAS } from './sheets.js';
import { crearFirmado, leerFirmado, crearSesion, ROLES } from './sesion.js';
import { ahoraISO } from './util.js';

const NOMBRE_RP = 'BE Group Chats';
const aObjeto = (f) => Object.fromEntries(HOJAS.Accesos.map((k, i) => [k, f[i] ?? '']));

// El dominio del panel (ej. begroup.vercel.app). Las llaves quedan atadas a ese dominio.
function sitio(request) {
  const u = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || u.host;
  const proto = request.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  const hostname = host.split(':')[0];
  return { rpID: hostname, origin: `${proto}://${host}` };
}

async function leerAccesos() {
  const [filas] = await puente([{ op: 'leer', hoja: 'Accesos' }]);
  return (filas || []).slice(1).map(aObjeto).filter((a) => a.credencial);
}
const guardarAcceso = (a) => puente([{ op: 'upsert', hoja: 'Accesos', valor: a.credencial, fila: HOJAS.Accesos.map((k) => a[k] ?? '') }]);

export async function listarAccesos(rol) {
  return (await leerAccesos()).filter((a) => a.activo !== 'no' && (rol === 'desarrollador' || a.rol === rol))
    .map(({ credencial, rol: r, dispositivo, fecha, usado }) => ({ credencial, rol: r, dispositivo, fecha, usado }));
}

// 1) Registrar este celular (con la sesión ya abierta con clave).
export async function opcionesRegistro(request, rol) {
  const { rpID } = sitio(request);
  const existentes = (await leerAccesos()).filter((a) => a.activo !== 'no');
  const opciones = await generateRegistrationOptions({
    rpName: NOMBRE_RP,
    rpID,
    userName: rol === 'dueno' ? 'dueño' : 'desarrollador',
    userDisplayName: rol === 'dueno' ? 'Dueño · BE Group' : 'Desarrollador · BE Group',
    userID: new TextEncoder().encode(`begroup-${rol}`),
    attestationType: 'none',
    excludeCredentials: existentes.map((a) => ({ id: a.credencial, transports: a.transportes ? a.transportes.split(',') : undefined })),
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
  });
  return { opciones, reto: crearFirmado({ tipo: 'registro', rol, desafio: opciones.challenge }, 300) };
}

export async function verificarRegistro(request, rol, { respuesta, reto, dispositivo }) {
  const r = leerFirmado(reto);
  if (r?.tipo !== 'registro' || r.rol !== rol) throw new Error('La solicitud venció: vuelve a intentarlo');
  const { rpID, origin } = sitio(request);
  const v = await verifyRegistrationResponse({ response: respuesta, expectedChallenge: r.desafio, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!v.verified || !v.registrationInfo) throw new Error('No se pudo verificar la llave de acceso');
  const c = v.registrationInfo.credential;
  await guardarAcceso({
    credencial: c.id,
    clave_publica: Buffer.from(c.publicKey).toString('base64url'),
    contador: String(c.counter || 0),
    rol,
    dispositivo: String(dispositivo || '').slice(0, 120),
    fecha: ahoraISO(),
    activo: 'sí',
    transportes: (c.transports || respuesta.response?.transports || []).join(','),
    usado: '',
  });
  return { credencial: c.id };
}

// 2) Entrar con Face ID / huella (sin clave).
export async function opcionesIngreso(request, credencial) {
  const { rpID } = sitio(request);
  const opciones = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credencial ? [{ id: String(credencial) }] : [],
  });
  return { opciones, reto: crearFirmado({ tipo: 'ingreso', desafio: opciones.challenge }, 300) };
}

export async function verificarIngreso(request, { respuesta, reto }) {
  const r = leerFirmado(reto);
  if (r?.tipo !== 'ingreso') throw new Error('La solicitud venció: vuelve a intentarlo');
  const acceso = (await leerAccesos()).find((a) => a.credencial === respuesta?.id && a.activo !== 'no');
  if (!acceso || !ROLES.includes(acceso.rol)) throw new Error('Este celular no tiene el ingreso con Face ID / huella activado (o fue desactivado). Entra con la clave.');
  const { rpID, origin } = sitio(request);
  const v = await verifyAuthenticationResponse({
    response: respuesta,
    expectedChallenge: r.desafio,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: acceso.credencial,
      publicKey: new Uint8Array(Buffer.from(acceso.clave_publica, 'base64url')),
      counter: Number(acceso.contador) || 0,
      transports: acceso.transportes ? acceso.transportes.split(',') : undefined,
    },
  });
  if (!v.verified) throw new Error('No se pudo verificar la identidad');
  await guardarAcceso({ ...acceso, contador: String(v.authenticationInfo.newCounter || 0), usado: ahoraISO() });
  return { token: crearSesion(acceso.rol), rol: acceso.rol };
}

export async function quitarAcceso(credencial, rol) {
  const acceso = (await leerAccesos()).find((a) => a.credencial === credencial);
  if (!acceso || (rol !== 'desarrollador' && acceso.rol !== rol)) return false;
  await guardarAcceso({ ...acceso, activo: 'no' });
  return true;
}
