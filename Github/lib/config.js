// Variables de entorno: se configuran en Vercel → Project → Settings → Environment Variables.
// Nunca se escriben en el código ni se suben a GitHub.

export const VARIABLES = [
  { nombre: 'WHATSAPP_TOKEN', descripcion: 'Token permanente de WhatsApp (usuario del sistema de Meta)' },
  { nombre: 'WHATSAPP_PHONE_NUMBER_ID', descripcion: 'Identificador del número de teléfono (no es el número)' },
  { nombre: 'WHATSAPP_VERIFY_TOKEN', descripcion: 'Texto inventado por ustedes para verificar el webhook en Meta' },
  { nombre: 'META_APP_SECRET', descripcion: 'Clave secreta de la app de Meta (verifica la firma de cada mensaje)' },
  { nombre: 'GEMINI_API_KEY', descripcion: 'Clave de Gemini (Google AI Studio)' },
  { nombre: 'APPS_SCRIPT_URL', descripcion: 'URL del Apps Script de la planilla (termina en /exec)' },
  { nombre: 'APPS_SCRIPT_CLAVE', descripcion: 'La misma clave que CLAVE dentro del Apps Script' },
  { nombre: 'TELEGRAM_BOT_TOKEN', descripcion: 'Opcional: token del bot de Telegram para copias y alertas (@BotFather)', opcional: true, secreta: true },
  { nombre: 'TELEGRAM_CHAT_ID', descripcion: 'Opcional: chat de Telegram que recibe las alertas (ver botón en el panel)', opcional: true, defecto: '' },
  { nombre: 'PANEL_PASSWORD', descripcion: 'Clave del perfil Desarrollador: ve todo el panel (larga, 16+ caracteres)' },
  { nombre: 'PANEL_PASSWORD_DUENO', descripcion: 'Clave del perfil Dueño: solo chats de WhatsApp y simulador (otra clave, distinta a la del desarrollador)', opcional: true, secreta: true },
  { nombre: 'CRON_SECRET', descripcion: 'Texto aleatorio que protege el envío automático de seguimiento' },
  { nombre: 'GEMINI_MODEL', descripcion: 'Modelo de Gemini', opcional: true, defecto: 'gemini-3.5-flash-lite' },
  { nombre: 'GEMINI_MODEL_RESPALDO', descripcion: 'Modelo de respaldo si el principal tarda más de 18 s o está saturado ("no" para desactivar)', opcional: true, defecto: 'gemini-3.6-flash' },
  { nombre: 'VAPID_PUBLIC_KEY', descripcion: 'Notificaciones al celular: clave pública (botón "Generar claves de notificación" en Estado)', opcional: true, defecto: '' },
  { nombre: 'VAPID_PRIVATE_KEY', descripcion: 'Notificaciones al celular: clave privada (se genera junto con la pública)', opcional: true, secreta: true },
  { nombre: 'WHATSAPP_API_VERSION', descripcion: 'Versión de la API de Meta', opcional: true, defecto: 'v23.0' },
];

export function env(nombre) {
  const v = process.env[nombre];
  if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  return VARIABLES.find((x) => x.nombre === nombre)?.defecto;
}

export function revisarVariables() {
  return VARIABLES.map((v) => ({
    nombre: v.nombre,
    descripcion: v.descripcion,
    opcional: !!v.opcional,
    presente: !!(process.env[v.nombre] && String(process.env[v.nombre]).trim()),
    valor: v.opcional && !v.secreta ? env(v.nombre) : undefined, // solo se muestran las opcionales que no son secretas
  }));
}
