// Contenido inicial de las pestañas técnicas (Mensajes y Configuracion), basado en
// "QA_Wsp_Business_BE_Group.docx" (oct 2026) y el correo de definiciones, reescrito con un tono más humano.
// El conocimiento (productos, precios, preguntas, derivación…) vive en las pestañas de BE Group.
// "Inicializar planilla" lo carga solo en pestañas vacías; "Reemplazar mensajes" del panel lo reescribe.

// Tono: cercano y natural, como una persona del equipo de ventas. Sin emojis, salvo el saludo.
const ENTREGA = 'La entrega es en Santiago y depende del stock; el plazo se confirma al momento de la compra.';
const CIERRE = 'Cualquier duda, me cuentas.';

export const MENSAJES = [
  ['bienvenida',
`Hola 👋 Gracias por escribir a BE Group. Soy el asistente virtual del equipo de Carla y te puedo ayudar con información de nuestros baños secos.

Tenemos tres opciones, todas sin agua y con separación de orina:

*BTW*: para uso masivo en parques, reservas, campings y sitios remotos.

*Villa*: para uso familiar en casas y cabañas sin alcantarillado.

*WKN Prime o Tiny*: para uso ocasional o móvil, como refugios, cabañas de fin de semana, camper o motorhome.

¿Cuál se acerca más a lo que necesitas?

Ahora el Villa tiene hasta 25% de descuento, y el WKN Prime y el Tiny un 15% en preventa, hasta agotar stock.`,
  'Primer mensaje a todo contacto nuevo.'],

  ['aviso_privacidad',
`La conversación queda registrada solo para responder tu consulta. Si en algún momento prefieres hablar con una persona, solo dímelo.`,
  'Se agrega al final de la bienvenida (Ley 21.719). Dejar vacío para no enviarlo.'],

  ['BTW_1',
`El BTW está pensado para lugares con mucho público. Se usa como un baño normal, pero no necesita agua ni electricidad.

Separa la orina de los sólidos desde la taza. La orina escurre por gravedad hacia un drenaje de infiltración, y los sólidos caen sobre una cinta inclinada que se mueve con un pedal hacia una bóveda trasera. Ahí se deshidratan y compostan de forma natural, y su volumen baja a cerca del 40%. La ventilación es pasiva, así que no hay olores.

Soporta más de 100 usos al día y la mantención es simple: unos 30 minutos, dos veces al mes.

Es ideal para parques nacionales, reservas, campings, senderos y faenas. Nosotros entregamos el artefacto y los planos de la caseta, que se construye en madera, piedra u otro material de la zona.`,
  'Opción a) – Mensaje 1: cómo funciona.'],

  ['BTW_2',
`Te dejo unos videos del BTW. Están en francés e inglés, pero se entienden bien solo con las imágenes.

Testimonio de usuarios en un baño público de altura, en Francia:
https://www.youtube.com/watch?v=NMNLO9QVjNw

Cómo funciona la tecnología:
https://www.youtube.com/watch?v=bxZ6LjDuKKw

Testimonio en el parque Smoke Bluffs, Canadá:
https://www.youtube.com/watch?v=Fg7gOCy5Eqs`,
  'Opción a) – Mensaje 2: videos.'],

  ['BTW_3',
`El BTW cuesta $3.750.000 + IVA. El precio final depende del tipo de cambio al momento de la compra.

${ENTREGA} Incluye los planos de la caseta y las guías de instalación y mantención, y tiene 12 meses de garantía de fábrica.

${CIERRE}`,
  'Opción a) – Mensaje 3: precio y plazo.'],

  ['VILLA_1',
`El Villa es el baño seco más completo que tenemos, de fabricación europea. Se usa igual que un WC normal, pero no necesita agua ni químicos: separa la orina de los sólidos, y así evita los olores y reduce mucho el volumen de residuos.

Funciona con 220 V o con 12 V (panel solar o batería). Tiene un ventilador silencioso que consume muy poco, unos 0,06 kWh al día, y su capacidad es ilimitada, así que sirve para uso diario o temporal. Se instala en un día, sin obras mayores.

El fabricante tiene más de 45 años de trayectoria y más de 130.000 unidades vendidas en el mundo. Es perfecto para casas, cabañas, proyectos off-grid y viviendas sin alcantarillado.`,
  'Opción b) – Mensaje 1: cómo funciona.'],

  ['VILLA_2',
`Te comparto dos videos del Villa. Están en inglés, pero se entienden bien con las imágenes.

Instalación:
https://www.youtube.com/watch?v=mYEc01tliqg

Uso y experiencia real:
https://www.youtube.com/watch?v=PNFzxJZtNaA`,
  'Opción b) – Mensaje 2: videos.'],

  ['VILLA_3',
`El Villa tiene un precio normal de $1.299.000, con IVA incluido. Ahora está con descuento, hasta agotar stock:

Por transferencia (25%): $974.250
Con tarjeta de crédito (23%): $1.000.230

${ENTREGA} Tiene 12 meses de garantía de fábrica.

${CIERRE}`,
  'Opción b) – Mensaje 3: precio y plazo.'],

  ['WKN_1',
`El WKN Prime es nuestro modelo más simple. Separa la orina de los sólidos igual que los otros, pero es 100% manual: no necesita electricidad, agua ni ventilación forzada.

Funciona con frío o calor, adentro o afuera, y es silencioso porque no tiene ventilador; los olores se controlan con material secante. Se puede fijar al piso o dejar suelto para moverlo. Para dos personas, la orina se vacía día por medio y los sólidos una vez a la semana.

Es ideal para cabañas de fin de semana, refugios y camping, y es la opción más económica.

Si lo necesitas para camper, motorhome o embarcación, te recomiendo el Tiny, que tiene el mismo precio. Es compacto y liviano (8,5 kg), tiene un ventilador de 12 V o 110–230 V que saca los olores hacia afuera, un contenedor de orina de 7,5 L con sensor de nivel y tapas que ocultan los sólidos y solo se abren al sentarse.`,
  'Opción c) – Mensaje 1: cómo funciona (WKN Prime y Tiny).'],

  ['WKN_2',
`Te dejo dos videos del WKN Prime. Están en inglés, pero se entienden bien con las imágenes.

Presentación:
https://youtube.com/shorts/8wrPeTe-Ofo

Instalación:
https://www.youtube.com/watch?v=mzxumF9KG7I`,
  'Opción c) – Mensaje 2: videos.'],

  ['WKN_3',
`El WKN Prime y el Tiny tienen el mismo precio: $865.000 cada uno, con IVA incluido. En preventa tienen 15% de descuento y quedan en $735.250, hasta agotar stock.

${ENTREGA} Ambos tienen 12 meses de garantía de fábrica.

${CIERRE}`,
  'Opción c) – Mensaje 3: precio y plazo.'],

  ['gracias',
`¡De nada! Lo que necesites, nos avisas.`,
  'Respuesta cuando el cliente agradece o cierra la conversación.'],

  ['pedir_datos',
`Claro. Por este WhatsApp solo podemos escribirnos, así que te llamamos nosotros. ¿Me dejas tu nombre, un teléfono y el horario que te acomode? Un ejecutivo te va a contactar.`,
  'Cuando el cliente pide hablar con una persona, negociar o algo que requiere un ejecutivo.'],

  ['sin_informacion',
`Ese dato no lo tengo confirmado y prefiero no darte información equivocada. Si quieres, un ejecutivo te llama para resolverlo: déjame tu nombre, un teléfono y el horario que te acomode.`,
  'Cuando la pregunta no está cubierta por la planilla, o cuando el validador bloquea una respuesta.'],

  ['datos_recibidos',
`Perfecto, {nombre}. Un ejecutivo te va a llamar al {telefono} ({horario}).`,
  'Confirmación al cliente cuando ya entregó nombre, teléfono y horario. Variables: {nombre} {telefono} {horario}.'],

  ['ya_derivado',
`Ya tenemos tu solicitud y un ejecutivo te va a llamar pronto. Si quieres cambiar el horario o el teléfono, escríbemelo aquí.`,
  'Cuando el cliente ya fue derivado y vuelve a pedir que lo llamen.'],

  ['solo_texto',
`Por aquí solo puedo leer mensajes de texto. ¿Me escribes tu consulta?`,
  'Respuesta a audios y stickers.'],

  ['archivo_recibido',
`Recibimos tu archivo. Te responde un asistente que solo lee texto, así que cuéntame en un mensaje qué necesitas. Si es por garantía o postventa, déjame tu nombre, un teléfono y un horario, y un ejecutivo te llama.`,
  'Respuesta a fotos, videos y documentos (el archivo queda registrado en Conversaciones).'],

  ['error',
`Disculpa, tuve un problema para responderte. Un ejecutivo va a revisar tu mensaje y te contactará pronto.`,
  'Se envía si falla la IA (salvo justo después de la bienvenida). También llega una alerta técnica por Telegram.'],
];

// Preguntas del documento de WhatsApp que no están en la pestaña "Preguntas frecuentes" de BE Group.
// "Inicializar planilla" las agrega al final de esa pestaña solo si no existen (mismas columnas).
export const FAQ_EXTRA = [
  ['Compra', 'Formas de pago / datos de transferencia',
`Se puede pagar por transferencia a BE Group SpA, RUT 77.142.535-6, Banco Security, cuenta corriente 920126560 (contacto@begroup.cl), o con tarjeta en https://www.webpay.cl/form-pay/372530. Emitimos boleta o factura al confirmar el pago.`,
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
