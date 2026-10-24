// Contenido inicial de las pestañas técnicas (Mensajes y Configuracion), tomado de
// "QA_Wsp_Business_BE_Group.docx" (oct 2026) y del correo de definiciones.
// El conocimiento (productos, precios, preguntas, derivación…) vive en las pestañas de BE Group.
// Solo se carga con "Inicializar planilla" y únicamente en pestañas vacías: nunca sobrescribe.
// Formato WhatsApp: *negrita*, _cursiva_.

const CIERRE = 'Esperamos haberte informado adecuadamente. Cualquier duda nos avisas 👍';
const ENTREGA = '📦 Entrega en Santiago, sujeta a disponibilidad de stock. El plazo se confirma al momento de la compra.';

export const MENSAJES = [
  ['bienvenida',
`👋 *¡Hola, buen día! Soy Carla de BE Group 🌱*

Tenemos 3 soluciones de saneamiento ecológico, todas sin agua y con separación de orina:

🏞️ a) BTW – uso masivo (parques, reservas, campings, sitios remotos)

🏠 b) Villa – uso familiar/residencial (casas y cabañas off-grid)

🏕️ c) WKN Prime / Tiny – uso ocasional y móvil (refugios, cabañas de fin de semana, camper y motorhome)

👉 ¿Cuál se ajusta a lo que necesitas: a) BTW, b) Villa o c) WKN Prime / Tiny?

🎉 Villa con hasta 25% de descuento, y WKN Prime y Tiny con 15% de descuento en preventa, hasta agotar stock.`,
  'Primer mensaje a todo contacto nuevo.'],

  ['aviso_privacidad',
`ℹ️ Esta conversación la atiende un asistente virtual del equipo de ventas y se registra solo para responder tu consulta.`,
  'Se agrega al final de la bienvenida. Recomendado por la Ley 21.719 y para no presentarse como persona. Dejar vacío para no enviarlo.'],

  ['BTW_1',
`*🚽♻️ Baño Seco BE Group BTW – Uso masivo, sin agua y sin energía*

El BE Group BTW funciona como un baño convencional, pero sin agua 🚱. Separa la orina de los sólidos desde el origen, imitando a la naturaleza: el humano es el único mamífero que junta el 1 y el 2 en un mismo lugar.

✅ Los residuos caen sobre una cinta transportadora inclinada; la orina escurre por gravedad hacia un drenaje de infiltración
✅ Los sólidos 💩 se desplazan a una bóveda trasera con un pedal accionado con el pie
✅ En la bóveda se deshidratan y compostan de forma natural, y su volumen baja a cerca del 40% 🌿
✅ No requiere electricidad: ventilación pasiva que evita los olores
✅ Más de 100 usos diarios
✅ Mantención simple: 30 minutos, dos veces al mes

🏞️ Ideal para parques nacionales, reservas, campings, senderos y faenas.

🏗️ Entregamos el artefacto y los planos de la caseta, que se construye en madera, piedra u otro material local.`,
  'Opción a) – Mensaje 1: cómo funciona.'],

  ['BTW_2',
`*📹 Te comparto videos de referencia del modelo BTW (en inglés y francés, pero la parte visual se entiende perfectamente sin necesidad de hablar el idioma):*

▶️ Testimonio de usuario 🇫🇷: "Toilettes sèches publiques en altitude"
👉 https://www.youtube.com/watch?v=NMNLO9QVjNw

▶️ Funcionamiento de la tecnología 🇺🇸: "Urine Diverting Decomposing/Dehydrating"
👉 https://www.youtube.com/watch?v=bxZ6LjDuKKw

▶️ Testimonio en Parque Smoke Bluffs, Squamish 🇨🇦
👉 https://www.youtube.com/watch?v=Fg7gOCy5Eqs

${CIERRE}`,
  'Opción a) – Mensaje 2: videos.'],

  ['BTW_3',
`*🚽✨ Baño Seco BE Group BTW*

💰 Precio: $3.750.000 + IVA
💲 El precio final depende del tipo de cambio al momento de la compra.
${ENTREGA}
📐 Incluye toda la información para la instalación: planos de la caseta y guías de instalación y mantención.
🛡️ Garantía de fábrica: 12 meses.

${CIERRE}`,
  'Opción a) – Mensaje 3: precio y plazo.'],

  ['VILLA_1',
`*🚽♻️ Baño Seco BE Group Villa – Sin agua, sin olores, sin complicaciones*

El BE Group Villa es el inodoro seco más avanzado del mercado. De fabricación europea, separa la orina de los sólidos, eliminando olores y reduciendo drásticamente el volumen de residuos. No necesita agua ni productos químicos.

✅ Diseñado para uso familiar: cómodo y discreto como cualquier WC convencional
✅ Funciona con 220 V o 12 V (panel solar o batería)
✅ Ventilador silencioso integrado, consumo mínimo (0,06 kWh al día)
✅ Capacidad ilimitada: ideal para uso continuo o temporal
✅ Instalación simple, en un día y sin obra mayor
✅ Fabricante con más de 45 años de trayectoria y más de 130.000 unidades vendidas en el mundo

🏔️ Perfecto para casas, cabañas, proyectos off-grid y viviendas sin alcantarillado.

💧 Solución sostenible e higiénica, sin red de agua – pensada para tu familia.`,
  'Opción b) – Mensaje 1: cómo funciona.'],

  ['VILLA_2',
`*📹 Te comparto 2 videos de referencia del modelo Villa (en inglés, pero la parte visual se entiende perfectamente sin necesidad de hablar el idioma):*

▶️ Instalación del Villa
👉 https://www.youtube.com/watch?v=mYEc01tliqg

▶️ Uso y experiencia real
👉 https://www.youtube.com/watch?v=PNFzxJZtNaA

${CIERRE}`,
  'Opción b) – Mensaje 2: videos.'],

  ['VILLA_3',
`*🚽✨ Baño Seco BE Group Villa*

💰 Precio normal: $1.299.000 (IVA incluido)
➡️ Transferencia bancaria: 25% dcto → $974.250
➡️ Tarjeta de crédito: 23% dcto → $1.000.230
⏳ Descuentos válidos hasta agotar stock
${ENTREGA}
🛡️ Garantía de fábrica: 12 meses.

${CIERRE}`,
  'Opción b) – Mensaje 3: precio y plazo.'],

  ['WKN_1',
`*🚽♻️ Baño Seco BE Group WKN Prime – Simple, manual y 100% off-grid*

El BE Group WKN Prime es la versión más simple de nuestra línea de baños secos. Separa la orina de los sólidos igual que nuestros otros modelos, pero sin ningún componente eléctrico: no necesita electricidad, agua ni ventilación forzada.

✅ Operación 100% manual: sin cables, sin enchufes, sin paneles solares
✅ Funciona en frío o calor, interior o exterior
✅ Silencioso (no tiene ventilador); los olores se controlan con material secante
✅ Instalación mínima: se puede fijar al piso o dejar libre y trasladable
✅ Vaciado según uso: para 2 personas, la orina día por medio y los sólidos 1 vez por semana

🏔️ Ideal para cabañas de fin de semana, refugios y camping.

💧 La solución más económica y sencilla para separar tus residuos sin agua ni electricidad.

🚐 ¿Lo necesitas para camper, motorhome o embarcación? Te recomendamos el BE Group Tiny, al mismo precio:
✅ Compacto y liviano (8,5 kg), diseñado para espacios pequeños y móviles
✅ Ventilador de 12 V o 110–230 V que extrae los olores al exterior
✅ Contenedor de orina de 7,5 L con sensor de nivel
✅ Tapas que ocultan los sólidos y se abren solo al sentarse`,
  'Opción c) – Mensaje 1: cómo funciona (WKN Prime y Tiny).'],

  ['WKN_2',
`*📹 Te comparto 2 videos de referencia del modelo WKN Prime (en inglés, pero la parte visual se entiende perfectamente sin necesidad de hablar el idioma):*

▶️ Promocional: "WKN Prime"
👉 https://youtube.com/shorts/8wrPeTe-Ofo

▶️ Instalación: "WKN Prime installation"
👉 https://www.youtube.com/watch?v=mzxumF9KG7I

${CIERRE}`,
  'Opción c) – Mensaje 2: videos.'],

  ['WKN_3',
`*🚽✨ Preventa – Baños Secos BE Group WKN Prime y BE Group Tiny*

💰 Precio normal: $865.000 (IVA incluido), cada modelo
➡️ Descuento preventa 15% → $735.250
⏳ Válido hasta agotar stock
${ENTREGA}
🛡️ Garantía de fábrica: 12 meses.

${CIERRE}`,
  'Opción c) – Mensaje 3: precio y plazo.'],

  ['gracias',
`😊 ¡De nada! Lo que necesites, nos avisas`,
  'Respuesta cuando el cliente agradece o cierra la conversación.'],

  ['pedir_datos',
`*📞 ¡Claro! Este WhatsApp solo recibe mensajes de texto, así que te llamamos nosotros.*

📝 Envíanos tu nombre, teléfono y el horario en que prefieres que te llamemos, y un ejecutivo se comunicará contigo 🤝`,
  'Cuando el cliente pide hablar con una persona, negociar o algo que requiere un ejecutivo.'],

  ['sin_informacion',
`🙏 Ese dato no lo tengo confirmado y prefiero no darte información incorrecta.

📞 Un ejecutivo puede llamarte para resolverlo: envíanos tu nombre, teléfono y el horario en que prefieres que te llamemos 🤝`,
  'Cuando la pregunta no está cubierta por la planilla, o cuando el validador bloquea una respuesta.'],

  ['datos_recibidos',
`✅ ¡Gracias, {nombre}! Un ejecutivo te llamará al {telefono} ({horario}) 🤝`,
  'Confirmación al cliente cuando ya entregó nombre, teléfono y horario. Variables: {nombre} {telefono} {horario}.'],

  ['ya_derivado',
`✅ Ya tenemos tu solicitud registrada y un ejecutivo te llamará pronto. Si quieres cambiar el horario o el teléfono, escríbelo aquí 🤝`,
  'Cuando el cliente ya fue derivado y vuelve a pedir que lo llamen.'],

  ['solo_texto',
`📝 Este WhatsApp solo recibe mensajes de texto. ¿Me escribes tu consulta, por favor? 🙌`,
  'Respuesta a audios y stickers.'],

  ['archivo_recibido',
`📎 Recibimos tu archivo. Este WhatsApp lo atiende un asistente que solo lee texto: cuéntanos en un mensaje qué necesitas y, si es por garantía o postventa, envíanos tu nombre, teléfono y horario para que un ejecutivo te llame 🤝`,
  'Respuesta a fotos, videos y documentos (el archivo queda registrado en Conversaciones).'],

  ['error',
`🙏 Disculpa, tuve un problema para responderte. Un ejecutivo revisará tu mensaje y te contactará pronto.`,
  'Se envía si falla la IA. También llega una alerta técnica por Telegram.'],
];

// Preguntas del documento de WhatsApp que no están en la pestaña "Preguntas frecuentes" de BE Group.
// "Inicializar planilla" las agrega al final de esa pestaña solo si no existen (mismas columnas).
export const FAQ_EXTRA = [
  ['Compra', 'Formas de pago / datos de transferencia',
`🏦 Transferencia bancaria: BE Group SpA · RUT 77.142.535-6 · Banco Security, Cta. Cte. 920126560 · contacto@begroup.cl. 💳 Pago con tarjeta: https://www.webpay.cl/form-pay/372530. Emitimos boleta o factura al confirmar el pago.`,
  'Documento QA WhatsApp'],
  ['General', '¿Hacen la instalación?',
`No realizamos la instalación. Entregamos toda la información necesaria (guías y planos) para que tú o tu maestro la realicen sin problemas.`,
  'Documento QA WhatsApp'],
  ['General', '¿Dónde se pueden ver los baños?',
`En Santiago, previa coordinación, ya que no tenemos oficina abierta a público. Escríbenos y agendamos una visita.`,
  'Documento QA WhatsApp'],
];

export const CONFIG = [
  ['bot_activo', 'sí', 'Interruptor general. "no" = el bot solo registra los mensajes y no responde.'],
  ['nombre_agente', 'Carla Sanchiz (Ventas Técnicas)', 'Nombre a cuyo nombre sale la atención.'],
  ['email_contacto', 'contacto@begroup.cl', 'Correo de contacto oficial.'],
  ['modelo_seguimiento', 'VILLA', 'Modelo que se envía si el cliente no elige a, b o c. Valores: BTW, VILLA, WKN o "no" para desactivar.'],
  ['minutos_seguimiento', '120', 'Minutos de espera después de la bienvenida antes de enviar el modelo de seguimiento. Debe ser menos de 24 horas (1440).'],
  ['horas_pausa_humano', '12', 'Horas que el bot queda en silencio en un chat después de que una persona responde desde Telegram.'],
  ['mensajes_historial', '12', 'Cuántos mensajes anteriores del chat ve la IA para entender el contexto.'],
  ['segundos_entre_mensajes', '1.5', 'Pausa entre los 3 mensajes de un modelo, para que lleguen en orden.'],
  ['replicar_telegram', 'sí', 'Copia cada conversación de WhatsApp al chat de Telegram, para que el dueño pueda responder desde ahí.'],
];

// Valores por defecto si alguien borra una fila de Configuración.
export const CONFIG_DEFECTO = Object.fromEntries(CONFIG.map(([k, v]) => [k, v]));
export const MENSAJES_DEFECTO = Object.fromEntries(MENSAJES.map(([k, v]) => [k, v]));
