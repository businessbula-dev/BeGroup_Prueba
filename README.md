# Agente de WhatsApp · BE Group

Bot que atiende el WhatsApp de BE Group con la información de la planilla **Agente_BeGroup** (Google Sheets) y Gemini. Cada conversación se copia a un chat de Telegram, desde donde el dueño puede contestar: su respuesta le llega al cliente por WhatsApp. Un panel web muestra las métricas (a cuántos se respondió, quiénes están pendientes y cuántas ventas se cerraron) y los logs.

No usa Apps Script: todo el código corre en **Vercel**. La planilla es la base de datos que BE Group edita.

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
public/index.html    panel: métricas, estado, simulador, logs, clientes y conversaciones
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

### 3. Telegram

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
| `TELEGRAM_BOT_TOKEN` | Paso 3 |
| `TELEGRAM_CHAT_ID` | Paso 6 (se puede dejar vacía al principio) |
| `PANEL_PASSWORD` | Inventarla: larga, de 16 caracteres o más |
| `CRON_SECRET` | Inventarla: texto aleatorio largo |
| `WHATSAPP_VERIFY_TOKEN` | Inventarla: cualquier texto; se repite en Meta (paso 7) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET` | Paso 7 |

4. **Deploy**.

> Importante: cada vez que se agrega o cambia una variable, hay que ir a **Deployments → … → Redeploy** para que se aplique.

> **Horario del seguimiento automático (cron):** `vercel.json` está configurado en `"0 12 * * *"` (una vez al día, 9:00 en Chile) para poder probar en una cuenta **Hobby**, que solo permite crons diarios. Al pasar a la cuenta **Pro** de BE Group, cambiarlo a `"*/15 * * * *"` para que el Villa llegue a los 120 minutos.

### 6. Panel

1. Abrir `https://<proyecto>.vercel.app` e ingresar la `PANEL_PASSWORD`.
2. Presionar **Inicializar planilla**: crea las 5 pestañas técnicas, carga los mensajes del flujo y agrega a "Preguntas frecuentes" 3 preguntas del documento de WhatsApp que faltaban (formas de pago, instalación, dónde ver los baños). No toca nada más de las pestañas de BE Group.
3. Presionar **Buscar chat de Telegram**, copiar el número que aparece en `TELEGRAM_CHAT_ID` en Vercel y hacer **Redeploy**.
4. **Probar alerta de Telegram**, y luego **Conectar respuestas por Telegram** (en ese orden: una vez conectadas las respuestas, "Buscar chat" deja de funcionar).
5. En **Estado**, Google Sheets, Gemini y Telegram deben estar en verde. WhatsApp queda en rojo hasta el paso 7.
6. En **Simulador**, probar conversaciones: un saludo, "b", una pregunta frecuente, una pregunta que no esté en la planilla, "quiero hablar con una persona". El simulador usa la planilla y Gemini reales, pero no envía nada por WhatsApp.

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
- En Telegram, con **Responder** sobre el mensaje del cliente: `/venta Villa por transferencia`, `/perdido muy caro` o `/abierto` para borrar.

Al marcar venta o sin venta, el cliente sale de las listas de pendientes. Queda guardado en Clientes (columnas `resultado`, `resultado_fecha`, `resultado_detalle`). Las pruebas del simulador no se cuentan.

### 7. Meta (WhatsApp Cloud API)

1. En [developers.facebook.com](https://developers.facebook.com), dentro del portafolio comercial de BE Group: **Crear app → caso de uso "Conectar con clientes a través de WhatsApp"**.
2. **WhatsApp → Configuración de la API**: Meta entrega un **número de prueba**. Copiar el **Identificador del número de teléfono** (`WHATSAPP_PHONE_NUMBER_ID`). Agregar tu celular como destinatario de prueba.
3. **Configuración de la app → Básica → Clave secreta de la app** → `META_APP_SECRET`.
4. **Token permanente**: [business.facebook.com](https://business.facebook.com) → Configuración → **Usuarios del sistema** → Agregar (Administrador) → **Asignar activos**: la app y la cuenta de WhatsApp con control total → **Generar token** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, caducidad **Nunca** → `WHATSAPP_TOKEN`.
   El token temporal del panel de Meta vence en 24 horas: no usarlo.
5. Cargar las 3 variables en Vercel y hacer **Redeploy**.
6. **WhatsApp → Configuración → Webhook**: URL de devolución de llamada = la URL que muestra el panel (`https://<proyecto>.vercel.app/api/webhook`); token de verificación = el mismo `WHATSAPP_VERIFY_TOKEN` → **Verificar y guardar**.
7. En **Campos del webhook**, suscribirse a `messages` (y a `smb_message_echoes` si el número queda en coexistencia).
8. Escribir desde tu celular al número de prueba: debe llegar la bienvenida, y en el panel aparece todo en Logs y Conversaciones.

### 8. Número real (+56 9 5220 1795): solo en la API

Decisión: el número se usa **solo en la API**. Deja de funcionar en la app WhatsApp Business y el dueño atiende desde Telegram. (La coexistencia, app y API a la vez, solo la puede activar un Solution Partner o Tech Provider de Meta.)

Hacerlo **después** de probar todo con el número de prueba:

1. En el teléfono, respaldar los chats de WhatsApp Business (o exportar los importantes) y desactivar la **verificación en dos pasos** si está activa.
2. En la app: **Ajustes → Cuenta → Eliminar cuenta**. El número sigue funcionando para llamadas y SMS; solo deja de estar en WhatsApp.
3. En la app de Meta: **WhatsApp → Configuración de la API → Agregar número de teléfono**. Nombre visible "BE Group" (Meta lo revisa). Verificar con el código que llega por SMS o llamada.
4. Copiar el nuevo **Identificador del número de teléfono** en `WHATSAPP_PHONE_NUMBER_ID` y hacer **Redeploy**.
5. Agregar un medio de pago en la cuenta de WhatsApp (Billing): sin él, Meta deja de entregar mensajes al pasar los 1.000 gratis del mes.
6. Escribir desde otro celular y revisar el panel y Telegram.

---

## Tiempos de respuesta

Estimación, sin medir con las cuentas reales:

| Caso | Tiempo aproximado |
| --- | --- |
| Bienvenida, a/b/c, "gracias" (sin IA) | 2 a 4 segundos hasta el primer mensaje; los 3 mensajes de un modelo salen con 1,5 s de diferencia |
| Respuesta con Gemini | 4 a 10 segundos |
| Primer mensaje después de un rato sin uso (Vercel y Apps Script "despiertan") | 1 a 3 segundos extra |

Por cada mensaje el bot hace **una** llamada al Apps Script para leer (catálogo, historial y cliente) antes de responder, y **una** para guardar después de responder. Esa lectura suma del orden de 1 a 2 segundos.

Cada respuesta queda medida en Logs (evento `respondido`: "el primero salió X s después…"), así que con uso real se ve el tiempo exacto.

## Editar el contenido (BE Group)

Todo se edita en la planilla y se aplica en menos de 1 minuto, sin tocar el código:

- **Pestañas de conocimiento** (Productos, Precios, Preguntas frecuentes…): se editan como siempre. Para desactivar una fila, escribir "Por confirmar" en alguna de sus celdas.
- **Mensajes**: bienvenida, los 3 mensajes de cada modelo, confirmaciones. No cambiar la columna `clave`. `datos_recibidos` acepta `{nombre}`, `{telefono}` y `{horario}`.
  El botón **Reemplazar mensajes** del panel (pestaña Estado) reescribe esta pestaña con la versión del código; se pierden los cambios hechos a mano ahí.
- **Configuracion**: `bot_activo` (interruptor general), minutos para el seguimiento del Villa, horas de pausa, etc.

**Si cambia un precio, hay que cambiarlo en dos lugares:** la pestaña **Precios** y el mensaje `*_3` del modelo en **Mensajes** (por ejemplo `VILLA_3`). El validador acepta cualquier monto que aparezca en la planilla, así que un precio viejo olvidado en Mensajes seguiría siendo "válido". Para evitarlo, el panel marca Google Sheets en rojo cuando un monto de Mensajes no aparece en ninguna pestaña de BE Group.

## Revisar problemas

En el panel, pestaña **Logs**, filtrar por **ERROR** o **WARN**:

| Evento | Qué significa | Qué hacer |
| --- | --- | --- |
| `firma_invalida` | El webhook no pudo verificar que el mensaje viene de Meta | Revisar `META_APP_SECRET` |
| `gemini_error` | Gemini no respondió | Revisar `GEMINI_API_KEY`, facturación o cuota |
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
