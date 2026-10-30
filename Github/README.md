# Agente de WhatsApp · BE Group

Bot que atiende el WhatsApp de BE Group con la información de la planilla **Agente_BeGroup** (Google Sheets) y Gemini. Carla responde a los clientes desde la **app de chats** (pestaña WhatsApp del panel, instalable en el celular), que avisa con una notificación cuando un cliente pide hablar con una persona, quiere comprar o deja sus datos para que lo llamen. El panel web también muestra las métricas (a cuántos se respondió, quiénes están pendientes y cuántas ventas se cerraron) y los logs. Telegram queda como opción.

Todo el código corre en **Vercel**. La planilla es la base de datos que BE Group edita, y se conecta con un pequeño Apps Script que hace de puente (paso 1).

## La planilla

| Pestañas | De quién son | Para qué |
| --- | --- | --- |
| Léeme, Empresa, Productos, Elegir modelo, Precios, Preguntas frecuentes, Proyectos, Derivación, Contacto, Videos y descargas (y cualquier otra que agreguen) | BE Group | Base de conocimiento. La IA solo responde con lo que está aquí, y las reglas de **Léeme** son obligatorias para ella. |
| Mensajes | BE Group (la crea el bot) | Mensajes fijos del flujo: bienvenida, los 3 de cada modelo, confirmaciones |
| Configuracion | BE Group (la crea el bot) | Interruptor del bot, minutos del seguimiento, horas de pausa, etc. |
| Clientes, Conversaciones, Logs | El bot | Registro de cada cliente, todos los mensajes y los eventos técnicos. No editar a mano. |

Reglas de lectura:
- Las filas que tengan una celda que empiece con **"Por confirmar"** o **"Pendiente"** no se usan. El color amarillo por sí solo no basta: hay que escribir el texto.
- En **Precios**, solo se usan las filas con **Estado = Vigente**.
- Se pueden agregar pestañas o columnas nuevas de conocimiento; el bot las lee solo. Lo que no hay que cambiar son los nombres de las pestañas técnicas.

## Cómo responde

| Situación | Qué hace | ¿Usa IA? |
| --- | --- | --- |
| Contacto nuevo | Mensaje de bienvenida (opciones a, b, c) + aviso de asistente virtual | No |
| Contacto nuevo que solo saluda o pide "info" | Solo la bienvenida (no consulta a la IA) | No |
| Responde a, b o c | Los 3 mensajes del modelo: cómo funciona, videos, precio y plazo | No |
| No responde después de la bienvenida | A los 120 minutos envía los 3 mensajes del Villa (configurable) | No |
| "Gracias por la información" | "😊 ¡De nada! Lo que necesites, nos avisas" | No |
| Audio o sticker | "Este WhatsApp solo recibe mensajes de texto…" | No |
| Foto, video o documento | Acusa recibo y pide que escriba qué necesita (útil en postventa) | No |
| Pregunta cubierta por la planilla | Responde con Gemini, usando solo las pestañas de BE Group | Sí |
| Situación de la hoja Derivación (hablar con alguien, cotización, negociación, institucional, postventa, sin respuesta) | Pide nombre, teléfono y horario; con los 3 datos envía la alerta a Telegram con el motivo | Sí |
| Menciona email, comuna, tipo de uso, cantidad o plazo | Lo guarda en Clientes y lo incluye en la alerta | Sí |
| La IA menciona un precio o % que no está en la planilla | No lo envía: deriva al ejecutivo y deja un WARN en Logs | — |
| El dueño responde en Telegram a la copia de un chat | Se envía al cliente por WhatsApp y el bot se calla 12 horas en ese chat (`/bot` lo reactiva) | — |

## Archivos

```
api/webhook.js       recibe los mensajes de WhatsApp (URL que se pone en Meta)
api/seguimiento.js   envío automático del Villa, cada 15 minutos (cron de Vercel)
api/panel.js         datos del panel (protegido con PANEL_PASSWORD)
api/telegram.js      recibe las respuestas del dueño desde Telegram
lib/                 lógica del bot, planilla, Gemini, WhatsApp, Telegram, validador de precios
lib/seed.js          mensajes del flujo y configuración inicial (del documento de WhatsApp)
apps-script/Codigo.gs  script "puente" que se pega en la planilla (Extensiones → Apps Script)
lib/metricas.js      cálculo de las métricas del panel
lib/respuestas-fijas.js  respuestas sin IA a las preguntas frecuentes (palabras clave)
lib/push.js          notificaciones al celular (Web Push)
public/index.html    panel: app de chats (WhatsApp), métricas, estado, simulador, logs, clientes y conversaciones
public/sw.js, public/manifest.webmanifest, public/icono-*.png  app instalable y notificaciones (ícono provisorio: reemplazar los icono-*.png)
lib/sesion.js        perfiles Dueño / Desarrollador y sesiones firmadas
lib/accesos.js       ingreso con Face ID / huella (llaves de acceso)
vercel.json          duración máxima de las funciones y horario del cron
.env.example         lista de variables (sin valores)
```

Las claves **nunca** van en el código: se cargan en Vercel como variables de entorno.

---

## Instalación paso a paso

Orden recomendado: 1 a 6 → probar en el Simulador del panel (sección "Probar sin WhatsApp") → 7 y 8.

### 1. Apps Script en la planilla

El bot no entra directo a la planilla: le pide los datos a un Apps Script pegado dentro de ella. Se hace con la cuenta dueña de la planilla (mbarros@begroup.cl):

1. Abrir la planilla **Agente_BeGroup** → **Extensiones → Apps Script**.
2. Borrar lo que haya en `Código.gs` y pegar el contenido completo de `apps-script/Codigo.gs`.
3. Cambiar `CLAVE` (línea `const CLAVE = '…'`) por un texto largo inventado. Esa misma clave va en Vercel como `APPS_SCRIPT_CLAVE`.
4. Guardar → **Implementar → Nueva implementación** → engranaje → **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. **Implementar** → autorizar con la cuenta de BE Group (Google avisa que la app no está verificada: **Configuración avanzada → Ir a … (no seguro)**; es el propio script de ustedes).
6. Copiar la **URL de la aplicación web** (termina en `/exec`): es `APPS_SCRIPT_URL`.

"Cualquier usuario" significa que cualquiera con la URL puede llamar al script, pero sin la `CLAVE` no lee ni escribe nada.

Si algún día se cambia el código del script: **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión**. Así la URL se mantiene.

### 2. Gemini

1. Entrar a [aistudio.google.com](https://aistudio.google.com) con la cuenta de BE Group → **Get API key → Create API key** (AI Studio crea solo el proyecto de Google Cloud que necesita).
2. Para producción, activar la facturación de ese proyecto (plan pagado), desde el mismo AI Studio o en Google Cloud → Facturación. En el plan gratuito Google puede usar las conversaciones para mejorar sus modelos, y estas tienen datos de clientes.

### 3. Telegram (opcional)

La app de chats (paso 6b) reemplaza a Telegram para responder y recibir avisos. Configurar Telegram solo si además se quiere una copia de cada conversación en un grupo.

1. En Telegram, abrir **@BotFather** → `/newbot` → nombre `WhatsApp BE Group` → usuario terminado en `bot`.
2. Guardar el token que entrega (es `TELEGRAM_BOT_TOKEN`).
3. Crear un grupo (por ejemplo "WhatsApp BE Group") con el dueño y quien más vaya a atender, agregar el bot y escribir cualquier mensaje en el grupo. Si atiende una sola persona, basta con abrir el bot y enviarle `/start`.
4. El `TELEGRAM_CHAT_ID` y la conexión de respuestas se hacen desde el panel (paso 6).

**Cómo se usa en el día a día:**
- Cada mensaje de un cliente llega al grupo con lo que respondió el bot, terminando en `ref 569…`.
- Para contestarle: mantener presionado ese mensaje → **Responder** → escribir. El texto le llega al cliente por WhatsApp, y Telegram confirma con ✅. El bot se calla 12 horas en ese chat (se cambia en Configuracion).
- Para devolverle el chat al bot: **Responder** con `/bot`.
- Para registrar el resultado: **Responder** con `/venta [detalle]`, `/perdido [motivo]` o `/abierto`.
- WhatsApp solo deja escribirle a un cliente hasta 24 horas después de su último mensaje. Pasado ese plazo, Telegram avisa que no se pudo enviar y hay que llamarlo.
- Solo texto: fotos o audios enviados desde Telegram no se reenvían.

### 4. GitHub

1. Crear un repositorio **privado** (idealmente en la cuenta u organización de BE Group) y agregar a buissnes.bula@gmail.com como colaborador.
2. Subir todos los archivos de esta carpeta, **sin** `node_modules` y sin ningún `.env`. Desde la web: **Add file → Upload files** y arrastrar las carpetas.

### 5. Vercel

1. En la cuenta Vercel de BE Group: **Add New → Project → Import** el repositorio.
2. **Framework Preset: Other**. No hace falta comando de build.
3. En **Environment Variables**, cargar estas variables (detalle en `.env.example`):

| Variable | De dónde sale |
| --- | --- |
| `APPS_SCRIPT_URL` | Paso 1.6 |
| `APPS_SCRIPT_CLAVE` | La misma `CLAVE` del paso 1.3 |
| `GEMINI_API_KEY` | Paso 2 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Paso 6b (notificaciones al celular) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Opcionales, paso 3 |
| `PANEL_PASSWORD` | Clave del perfil **Desarrollador**. Inventarla: larga, de 16 caracteres o más |
| `PANEL_PASSWORD_DUENO` | Clave del perfil **Dueño** (otra distinta). Ver paso 6a |
| `CRON_SECRET` | Inventarla: texto aleatorio largo |
| `WHATSAPP_VERIFY_TOKEN` | Inventarla: cualquier texto; se repite en Meta (paso 7) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET` | Paso 7 |

4. **Deploy**.

> Importante: cada vez que se agrega o cambia una variable, hay que ir a **Deployments → … → Redeploy** para que se aplique.

> **Horario del seguimiento automático (cron):** `vercel.json` está configurado en `"0 12 * * *"` (una vez al día, 9:00 en Chile) para poder probar en una cuenta **Hobby**, que solo permite crons diarios. Al pasar a la cuenta **Pro** de BE Group, cambiarlo a `"*/15 * * * *"` para que el Villa llegue a los 120 minutos.

### 6. Panel

1. Abrir `https://<proyecto>.vercel.app` e ingresar la `PANEL_PASSWORD`.
2. Presionar **Inicializar planilla**: crea las pestañas técnicas (Mensajes, Mensajes emojis, Configuracion, Clientes, Conversaciones, Logs, Dispositivos y Accesos), carga los mensajes del flujo y agrega a "Preguntas frecuentes" 3 preguntas del documento de WhatsApp que faltaban (formas de pago, instalación, dónde ver los baños). No toca nada más de las pestañas de BE Group.
3. Solo si se usa Telegram: **Buscar chat de Telegram**, copiar el número en `TELEGRAM_CHAT_ID` en Vercel + **Redeploy**, **Probar alerta de Telegram** y luego **Conectar respuestas por Telegram** (en ese orden).
4. En **Estado**, Google Sheets y Gemini deben estar en verde. Notificaciones queda en rojo hasta el paso 6b y WhatsApp hasta el paso 7.
5. En **Simulador**, probar conversaciones: un saludo, "b", una pregunta frecuente, una pregunta que no esté en la planilla, "quiero hablar con una persona". El simulador usa la planilla y Gemini reales, pero no envía nada por WhatsApp.

## Probar sin WhatsApp

No necesita Meta ni el número de WhatsApp: usa la planilla y Gemini reales.

### Simulador del panel (después del paso 6)

Pestaña **Simulador**: escribes como si fueras un cliente y ves lo que respondería el bot, sin enviar nada por WhatsApp. "Nuevo cliente" empieza otra conversación.

Conversaciones que conviene probar:

| Escribir | Debería pasar |
| --- | --- |
| hola | Bienvenida con las opciones a, b, c |
| b | Los 3 mensajes del Villa |
| ¿hacen despacho a Puerto Montt? | Respuesta de Preguntas frecuentes |
| ¿y si llevo 3, cuánto sale? | No inventa un total: ofrece que lo llame un ejecutivo |
| quiero hablar con una persona | Pide nombre, teléfono y horario |
| Juan Pérez, 912345678, mañana en la tarde | Confirma y envía la alerta a Telegram |
| gracias por la información | "¡De nada! Lo que necesites, nos avisas" |
| ¿eres un bot? | Responde con honestidad que es un asistente virtual |
| ¿tienen el modelo XYZ? | Dice que no tiene ese dato y deriva |

### 6a. Perfiles: Dueño y Desarrollador

La pantalla de ingreso tiene dos perfiles:

| Perfil | Clave | Ve |
| --- | --- | --- |
| **Dueño** | `PANEL_PASSWORD_DUENO` | Solo **Chats** (WhatsApp), **Simulador** y **Cuenta**, con diseño para celular y barra de pestañas abajo |
| **Desarrollador** | `PANEL_PASSWORD` | Todo el panel (métricas, estado, simulador, logs, clientes, conversaciones y chats) |

Los permisos se revisan también en el servidor: con la sesión del dueño no se pueden ver métricas, estado ni logs, ni usar acciones como "Inicializar planilla". Al entrar se entrega una sesión firmada de 30 días (la clave no queda guardada en el celular). Si se cambia cualquiera de las dos claves en Vercel (+ Redeploy), todas las sesiones abiertas se cierran.

**Face ID / huella (celular):** en el perfil Dueño, la primera vez que se entra con la clave en el celular se ofrece "Entrar con Face ID" (iPhone) o "huella o rostro" (Android, Samsung). También está en Cuenta. Usa llaves de acceso (passkeys, estándar WebAuthn): la cara o la huella nunca salen del celular; en la planilla (pestaña **Accesos**) solo queda la llave pública de cada celular. Con esto activado, al abrir la app se pide Face ID / huella en vez de la clave. Para quitarle el acceso a un celular perdido, poner `no` en la columna `activo` de Accesos. Las llaves quedan atadas a la dirección del panel: si cambia el dominio en Vercel, hay que volver a activarlas. Requiere iOS 16 o superior, o Android 9 o superior con bloqueo de pantalla configurado.

### 6b. App de chats en el celular de Carla

La pestaña **WhatsApp** del panel es la bandeja de conversaciones: lista de chats (con filtros Sin leer, Piden persona, Por llamar y Pruebas), cada conversación completa (cliente, bot y lo que escribió Carla) y un cuadro para responder. Al responder, el mensaje le llega al cliente por WhatsApp y el bot se pausa en ese chat (12 horas, se cambia en Configuracion; "Reactivar bot" lo devuelve antes). El botón ⓘ muestra la ficha del cliente y los botones Venta / Sin venta. Se actualiza sola cada pocos segundos mientras está abierta.

**Notificaciones (una vez):**
1. En el panel: Estado → **Generar claves de notificación**. Copiar `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en Vercel (Environment Variables) y hacer **Redeploy**. La privada es secreta.
2. Presionar **Inicializar planilla** si la pestaña Dispositivos no existe todavía.

**Instalar en el celular:**
- **Android (Chrome):** abrir `https://<proyecto>.vercel.app`, menú ⋮ → **Instalar app** (o **Agregar a la pantalla principal**).
- **iPhone (Safari):** abrir la misma dirección, botón **Compartir** → **Agregar a inicio**. En iPhone las notificaciones solo funcionan desde la app agregada a la pantalla de inicio (iOS 16.4 o superior).
- Abrir la app desde el ícono **BE Chats**, elegir **Dueño**, entrar con `PANEL_PASSWORD_DUENO`, aceptar **Face ID / huella** y tocar **Activar notificaciones** → Permitir.
- Probar: la campana de la app (o Estado → **Probar notificación**) envía un aviso de prueba. Las conversaciones del Simulador también generan avisos, marcados "🧪 Prueba".

**Cuándo llega un aviso:** cuando un cliente pide hablar con una persona o algo que requiere un ejecutivo (comprar, cotizar, negociar, postventa), y otra vez cuando deja nombre, teléfono y horario ("llamar a …"). Las demás conversaciones las atiende el bot sin avisar. Tocar el aviso abre ese chat.

**Límites:** WhatsApp solo deja escribirle a un cliente hasta 24 horas después de su último mensaje; pasado ese plazo la app lo indica y hay que llamarlo (botón 📞). Solo se envía texto. Los celulares que activaron avisos quedan en la pestaña Dispositivos (se pueden desactivar poniendo `no` en la columna activo).

## Métricas y ventas

La pestaña **Métricas** del panel (la primera) muestra:
- **Personas que escribieron**, **respondidas por el bot**, **pendientes**, **ventas** con su % de conversión y el **tiempo de respuesta** mediano.
- **Embudo**: escribieron → respondidos → eligieron modelo → pidieron que los llamen → venta.
- **Personas por día** de los últimos 14 días (al pasar el mouse se ve el detalle).
- Tres listas de pendientes:
  - **Por llamar**: dejaron nombre, teléfono y horario.
  - **Sin respuesta**: su último mensaje lleva más de 5 minutos sin contestar (bot en pausa, apagado o con error).
  - **Datos incompletos**: el bot les pidió los datos y faltan algunos.
- **Por modelo**: interesados, ventas y conversión de cada modelo.

El bot no puede saber cuándo se concreta una venta, así que se marca a mano, de dos formas:
- En el panel, con los botones **Venta** / **Sin venta** (en Métricas o en Clientes). **Deshacer** lo borra.
- En la app de chats, en la ficha del cliente (botón ⓘ).
- Si se usa Telegram, con **Responder** sobre el mensaje del cliente: `/venta Villa por transferencia`, `/perdido muy caro` o `/abierto` para borrar.

Al marcar venta o sin venta, el cliente sale de las listas de pendientes. Queda guardado en Clientes (columnas `resultado`, `resultado_fecha`, `resultado_detalle`). Las pruebas del simulador no se cuentan.

### 7. Meta (WhatsApp Cloud API) con el número de prueba

1. En [developers.facebook.com](https://developers.facebook.com) → **Mis apps → Crear app** → caso de uso **"Conectar con clientes a través de WhatsApp"** → elegir el portafolio comercial de BE Group → **Crear app**.
2. **Comenzar a usar la API → Configuración de la API**: crear (o conectar) la cuenta de WhatsApp Business. Meta entrega un **número de prueba**. Copiar el **Identificador del número de teléfono** → `WHATSAPP_PHONE_NUMBER_ID`. En "Para", agregar tu celular como destinatario de prueba (llega un código por WhatsApp).
3. **Configuración de la app → Básica → Clave secreta de la app** (botón Mostrar) → `META_APP_SECRET`.
4. **Token permanente**: [business.facebook.com](https://business.facebook.com) → Configuración → **Usuarios del sistema** → Agregar (rol Administrador) → **Asignar activos**: la app (Administrar app) y la cuenta de WhatsApp (control total) → **Generar token** para esa app, caducidad **Nunca**, permisos `business_management`, `whatsapp_business_messaging` y `whatsapp_business_management` → `WHATSAPP_TOKEN`. El token temporal de "Configuración de la API" vence en 24 horas: no usarlo.
5. Cargar las 3 variables en Vercel (junto con `WHATSAPP_VERIFY_TOKEN`, un texto inventado) y hacer **Redeploy**. En el panel → Estado, el cuadro **WhatsApp** debe quedar en verde.
6. En la app de Meta → **WhatsApp → Configuración → Webhook → Editar**: URL de devolución de llamada = la que muestra el panel en Estado (`https://<proyecto>.vercel.app/api/webhook`); token de verificación = el mismo `WHATSAPP_VERIFY_TOKEN` → **Verificar y guardar**.
7. En **Campos del webhook**, suscribirse a `messages`.
8. Desde tu celular, escribir "hola" al número de prueba: debe llegar la bienvenida, y en el panel aparecen el chat (WhatsApp), Logs y Conversaciones. Probar también "precio del villa" y "quiero hablar con una persona" (debe llegar la notificación al celular del dueño).

### 8. Número real (+56 9 5220 1795): solo en la API

Decisión: el número se usa **solo en la API**. Deja de funcionar en la app WhatsApp Business y Carla atiende desde la app de chats del panel (paso 6b). (La coexistencia, app y API a la vez, solo la puede activar un Solution Partner o Tech Provider de Meta.)

Hacerlo **después** de probar todo con el número de prueba, en un horario con pocos mensajes:

1. En el teléfono, **respaldar o exportar** los chats importantes de WhatsApp Business: al eliminar la cuenta se pierde el historial. Anotar el PIN de verificación en dos pasos si tiene uno (Ajustes → Cuenta → Verificación en dos pasos).
2. En la app: **Ajustes → Cuenta → Eliminar cuenta**. El número sigue funcionando para llamadas y SMS. Esperar unos **3 minutos** a que Meta lo libere (los mensajes que lleguen mientras tanto quedan en cola).
3. En la app de Meta → **Configuración de la API → Agregar número de teléfono**: nombre visible **BE Group** (Meta lo revisa), categoría, y verificar con el código que llega por **SMS o llamada** al número.
4. Copiar el **Identificador del número de teléfono** del número real en `WHATSAPP_PHONE_NUMBER_ID` en Vercel y hacer **Redeploy**.
5. En el panel → Estado → **Registrar número en WhatsApp (PIN)**: escribir el PIN de 6 dígitos del paso 1, o inventar uno nuevo si no tenía, y guardarlo. Meta exige este registro y permite máximo 10 intentos cada 72 horas.
6. **Facturación (Billing Hub) → Método de pago**: agregar una tarjeta. Desde el 1 de octubre de 2026 cada número tiene **1.000 mensajes de respuesta gratis al mes**; desde el 1.001 se cobran, y sin medio de pago Meta deja de entregarlos. Las respuestas a clientes que llegan desde un anuncio de Facebook/Instagram con botón de WhatsApp son gratis durante 7 días.
7. Escribir desde otro celular al número real y revisar el panel. Si no llegan los mensajes: revisar que el webhook siga suscrito a `messages` y que la app esté **publicada** (modo "Live"; Meta puede pedir una URL de política de privacidad).

---

## Tiempos de respuesta

Estimación, sin medir con las cuentas reales:

| Caso | Tiempo aproximado |
| --- | --- |
| Bienvenida, a/b/c, "gracias" (sin IA) | 2 a 4 segundos hasta el primer mensaje; los 3 mensajes de un modelo salen con 1,5 s de diferencia |
| Respuesta con Gemini | 4 a 10 segundos |
| Primer mensaje después de un rato sin uso (Vercel y Apps Script "despiertan") | 1 a 3 segundos extra |

Para medir el tiempo real de Gemini: panel → **Estado → Probar velocidad de Gemini**. Hace la misma consulta real (instrucciones y planilla) al modelo principal (`GEMINI_MODEL`, por defecto `gemini-3.5-flash-lite`) y al de respaldo (`GEMINI_MODEL_RESPALDO`, por defecto `gemini-3.6-flash`) y muestra los segundos y tokens de cada uno. Si el principal no responde en 18 segundos, o Google está saturado, el bot reintenta solo con el de respaldo y deja un aviso `gemini_lento` en Logs. En la prueba de octubre de 2026 (plan gratuito), `gemini-3.8-flash` estaba saturado y `gemini-3.5-flash-lite` respondió en 1,1 segundos.

Sobre los modelos, el bot envía solo lo que el cliente pide, sin consultar a Gemini:

| El cliente escribe | Recibe |
| --- | --- |
| "b", "el villa", "me interesa el Villa" (elige el modelo) | Los 3 mensajes del modelo |
| "precio del Villa", "¿cuánto cuesta?" | Solo el mensaje de precio y plazo |
| "¿cómo funciona el BTW?", "características" | Solo el mensaje de cómo funciona |
| "¿tienen videos?", "¿cómo se usa / se instala?" | Solo los videos |
| "más información del Villa", "cuéntame del Tiny" | Cómo funciona + videos |

Si no nombra el modelo ("¿y cuánto cuesta?"), se usa el que ya eligió. Si el mensaje trae algo más (cantidades, dos modelos, otra pregunta), responde la IA, también con la instrucción de contestar solo lo que se preguntó y mencionar los videos solo si pide más información o ver el producto.

**Respuestas sin IA.** Si el mensaje calza con una sola pregunta de la pestaña **Preguntas frecuentes**, se envía su "Respuesta aprobada" tal cual, sin consultar a Gemini (queda `respuesta_fija` en Logs). "Quiero hablar con una persona" o "¿me pueden llamar?" piden los datos para la llamada directamente. Cada pregunta se reconoce por la columna **Palabras clave** (la crea "Inicializar planilla"), separadas por comas:

| Escrito | Calza con |
| --- | --- |
| `garantia` | la palabra completa (tildes y mayúsculas dan lo mismo) |
| `despach*` | palabras que empiezan así: despacho, despachan… |
| `cada cuanto se vacia` | la frase seguida |
| `envio* + region*` | ambas, en cualquier parte del mensaje |
| `!caseta` | en preguntas de un modelo (Tema BTW, Villa, WKN Prime o Tiny), basta esa palabra aunque el cliente no nombre el modelo |

Para agregar una respuesta fija, BE Group agrega una fila con la pregunta, la respuesta aprobada y sus palabras clave. Las preguntas de un modelo solo se usan si el cliente nombra ese modelo o ya lo eligió. Para no equivocarse, decide la IA cuando el mensaje es largo, tiene números (fechas, cantidades, teléfonos), habla de precios, compras o reclamos, o calza con dos preguntas o más.

Por cada mensaje el bot hace **una** llamada al Apps Script para leer (catálogo, historial y cliente) antes de responder, y **una** para guardar después de responder. Esa lectura suma del orden de 1 a 2 segundos.

Cada respuesta queda medida en Logs (evento `respondido`: "el primero salió X s después…"), así que con uso real se ve el tiempo exacto.

## Editar el contenido (BE Group)

Todo se edita en la planilla y se aplica en menos de 1 minuto, sin tocar el código:

- **Pestañas de conocimiento** (Productos, Precios, Preguntas frecuentes…): se editan como siempre. Para desactivar una fila, escribir "Por confirmar" en alguna de sus celdas.
- **Mensajes** y **Mensajes emojis**: bienvenida, los 3 mensajes de cada modelo, confirmaciones. No cambiar la columna `clave`. `datos_recibidos` acepta `{nombre}`, `{telefono}` y `{horario}`.
  Para que el bot no repita siempre lo mismo, una celda puede tener **varias versiones** separadas por una línea que diga solo `---`. En cada chat se van alternando en orden. Ya vienen así `sin_informacion` (4 versiones), `pedir_datos` y `ya_derivado` (3 cada una); se pueden agregar más o usarlo en otros mensajes.
  Hay dos pestañas de mensajes, una por cada forma de responder: **Mensajes** (formal, sin emojis) y **Mensajes emojis** (los textos originales del documento de BE Group). En **Estado → Forma de responder** se elige cuál se usa; cambiar no reescribe nada, así que cada pestaña se puede editar por separado. El estilo queda guardado como `estilo` en Configuracion y la IA ajusta su tono (con o sin emojis). **Restaurar mensajes** vuelve a poner los textos originales del código en las dos pestañas.
- **Configuracion**: `bot_activo` (interruptor general), minutos para el seguimiento del Villa, horas de pausa, etc.

**Si cambia un precio, hay que cambiarlo en dos lugares:** la pestaña **Precios** y el mensaje `*_3` del modelo en **Mensajes** (por ejemplo `VILLA_3`). El validador acepta cualquier monto que aparezca en la planilla, así que un precio viejo olvidado en Mensajes seguiría siendo "válido". Para evitarlo, el panel marca Google Sheets en rojo cuando un monto de Mensajes no aparece en ninguna pestaña de BE Group.

## Revisar problemas

En el panel, pestaña **Logs**, filtrar por **ERROR** o **WARN**:

| Evento | Qué significa | Qué hacer |
| --- | --- | --- |
| `firma_invalida` | El webhook no pudo verificar que el mensaje viene de Meta | Revisar `META_APP_SECRET` |
| `gemini_error` | Gemini no respondió | Revisar `GEMINI_API_KEY`, facturación o cuota; usar "Probar velocidad de Gemini" |
| `gemini_lento` | El modelo principal tardó más de 18 s o estaba saturado; respondió el de respaldo | Si se repite, usar "Probar velocidad de Gemini" y cambiar `GEMINI_MODEL` |
| `respuesta_bloqueada` | La IA quiso dar un precio que no está en la planilla | Normal. Si se repite, agregar esa información a Preguntas frecuentes |
| `envio_fallido` | WhatsApp no entregó un mensaje | Ver el código del error (131047 = pasaron más de 24 h; 190 = token vencido) |
| `telegram_error` / `telegram_sin_configurar` | No llegó una alerta | Revisar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` |
| `error_guardando_planilla` | No se pudo escribir en la planilla | Revisar que el Apps Script siga implementado y que `APPS_SCRIPT_CLAVE` sea igual a `CLAVE` |
| `bot_en_pausa` | Una persona está atendiendo ese chat | Se reactiva con `/bot` en Telegram o desde **Clientes** |
| `respuesta_telegram_fallida` | No se pudo enviar al cliente lo que escribió el dueño | Ver el detalle (131047 = pasaron más de 24 h) |
| `telegram_chat_desconocido` | Alguien escribió al bot desde otro chat | Si es el chat correcto, poner ese número en `TELEGRAM_CHAT_ID` |

Los problemas técnicos también llegan a Telegram como "problema técnico" (como máximo uno cada 10 minutos por tipo). Los logs detallados de cada ejecución están en Vercel → proyecto → **Logs**.

## Pruebas automáticas

Las pruebas (con servicios simulados y una copia de la planilla) y las herramientas de terminal están en la carpeta de desarrollo `agente-begroup`, que no se sube a GitHub.
