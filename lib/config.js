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
  { nombre: 'TELEGRAM_BOT_TOKEN', descripcion: 'Token del bot de Telegram para alertas (@BotFather)' },
  { nombre: 'TELEGRAM_CHAT_ID', descripcion: 'Chat que recibe las alertas (ver botón en el panel)' },
  { nombre: 'PANEL_PASSWORD', descripcion: 'Clave para entrar al panel de logs (larga, 16+ caracteres)' },
  { nombre: 'CRON_SECRET', descripcion: 'Texto aleatorio que protege el envío automático de seguimiento' },
  { nombre: 'GEMINI_MODEL', descripcion: 'Modelo de Gemini', opcional: true, defecto: 'gemini-2.5-flash' },
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
    valor: v.opcional ? env(v.nombre) : undefined, // solo se muestran las opcionales (no son secretas)
  }));
}
