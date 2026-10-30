# Agente de WhatsApp · BE Group

Bot que atiende el WhatsApp de BE Group con la información de la planilla **Agente_BeGroup** (Google Sheets) y Gemini.

- **Carla** responde a los clientes desde la **app de chats**: la pestaña WhatsApp del panel, instalable en el celular.
- La app avisa con una notificación cuando un cliente pide hablar con una persona, quiere comprar o deja sus datos para que lo llamen.
- El panel web también muestra las métricas (a cuántos se respondió, quiénes están pendientes y cuántas ventas se cerraron), el estado de las conexiones y los logs.

Todo el código corre en **Vercel**. La planilla es la base de datos que BE Group edita, y se conecta mediante un pequeño Apps Script que hace de puente.

---

## Instalación completa desde cero

Esta guía instala todo a nombre de BE Group: su planilla, su GitHub, su Vercel y su cuenta de Meta. Nada se reutiliza de las cuentas de prueba del desarrollador. Los pasos van en este orden:

| Paso | Qué | Tiempo aprox. |
| --- | --- | --- |
| 0 | Cuentas y claves inventadas | 10 min |
| 1 | Planilla + Apps Script | 15 min |
| 2 | Gemini | 5 min |
| 3 | GitHub | 5 min |
| 4 | Vercel | 10 min |
| 5 | Panel: inicializar, notificaciones y simulador | 15 min |
| 6 | Celular de Carla (app, Face ID, notificaciones) | 10 min |
| 7 | Meta con el número de prueba | 45 min |
| 8 | Número real | 30 min + espera de Meta |
| 9 | Dejarlo listo para producción | 10 min |

Con los pasos 1 a 6 el bot ya funciona en el **Simulador** del panel, sin WhatsApp. Conviene probarlo ahí antes de seguir con Meta.

### 0. Antes de empezar

**Cuentas (todas de BE Group, idealmente con el correo de la empresa):**

| Cuenta | Para qué | Nota |
| --- | --- | --- |
| Google (la dueña de la planilla) | Planilla, Apps Script y Gemini | La misma cuenta para los tres |
| GitHub | Guardar el código | Repositorio privado |
| Vercel | Correr el bot y el panel | Plan **Pro** para que el seguimiento del Villa funcione cada 15 minutos (el plan Hobby sirve para probar) |
| Portafolio comercial de Meta ([business.facebook.com](https://business.facebook.com)) | WhatsApp Cloud API | Si BE Group ya tiene anuncios en Facebook o Instagram, ya tiene uno: usar ese |
| Cuenta de desarrollador de Meta ([developers.facebook.com](https://developers.facebook.com)) | Crear la app de WhatsApp | Se entra con el Facebook personal de un administrador del portafolio |

Si el desarrollador hace la instalación, BE Group lo agrega como **administrador** de su portafolio de Meta (business.facebook.com → Configuración → Personas → Agregar), y como colaborador en GitHub y miembro en Vercel. Si no, alguien de BE Group inicia sesión y el desarrollador lo guía.

**Inventar estos textos** y guardarlos en un gestor de contraseñas (no en un chat ni en un correo):

| Nombre | Para qué | Cómo |
| --- | --- | --- |
| `CLAVE` del Apps Script (= `APPS_SCRIPT_CLAVE`) | Que solo el bot pueda leer y escribir la planilla | 30 caracteres o más, letras y números |
| `PANEL_PASSWORD` | Entrar al panel como **Desarrollador** | 16 caracteres o más |
| `PANEL_PASSWORD_DUENO` | Entrar como **Dueño** (Carla) | 16 caracteres o más, distinta a la anterior |
| `CRON_SECRET` | Proteger el seguimiento automático | Texto aleatorio largo |
| `WHATSAPP_VERIFY_TOKEN` | Verificar el webhook en Meta | Cualquier texto, por ejemplo `begroup-webhook-2026` |

### 1. Planilla y Apps Script

**La planilla:**
1. En el Google Drive de BE Group, crear la planilla **Agente_BeGroup**. Si viene de otra cuenta: **Archivo → Hacer una copia**; si viene como `.xlsx`, subirla y **Abrir con Hojas de cálculo de Google → Archivo → Guardar como Hojas de cálculo de Google**.
2. Debe tener las pestañas de conocimiento de BE Group (Léeme, Empresa, Productos, Elegir modelo, Precios, Preguntas frecuentes, Proyectos, Derivación, Contacto, Videos y descargas). Las pestañas técnicas (Mensajes, Clientes, Logs, etc.) **no** se copian a mano: las crea el panel en el paso 5. Si la copia trae Clientes, Conversaciones o Logs de pruebas, borrar esas pestañas.

**El Apps Script (puente entre el bot y la planilla):**
1. En la planilla: **Extensiones → Apps Script**.
2. Borrar lo que haya en `Código.gs` y pegar el contenido **completo** de `apps-script/Codigo.gs` (de la carpeta Github).
3. Reemplazar el texto de la línea `const CLAVE = '…'` por la `CLAVE` inventada en el paso 0.
4. Guardar (ícono de disquete) → **Implementar → Nueva implementación** → engranaje → **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. **Implementar** → **Autorizar acceso** con la cuenta de BE Group. Google avisa que la app no está verificada: **Configuración avanzada → Ir a … (no seguro)** → Permitir. Es el propio script de ustedes.
6. Copiar la **URL de la aplicación web** (termina en `/exec`): es `APPS_SCRIPT_URL`.

"Cualquier usuario" significa que cualquiera con la URL puede llamar al script, pero sin la `CLAVE` no lee ni escribe nada.

> **Si algún día cambia `Codigo.gs`:** pegar el nuevo código, mantener la misma `CLAVE`, y luego **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar**. Así la URL no cambia. Si se olvida este paso, el panel lo avisa: "El Apps Script de la planilla es una versión antigua".

### 2. Gemini

1. Entrar a [aistudio.google.com](https://aistudio.google.com) con la cuenta de BE Group → **Get API key → Create API key**. AI Studio crea solo el proyecto de Google Cloud que necesita.
2. Copiar la clave: es `GEMINI_API_KEY`.
3. Para producción, activar la **facturación** de ese proyecto (plan pagado), desde el mismo AI Studio o en Google Cloud → Facturación. En el plan gratuito Google puede usar las conversaciones para mejorar sus modelos, y estas tienen datos de clientes. El costo es bajo: el bot usa el modelo más económico y responde sin IA todo lo que puede.

### 3. GitHub

1. En GitHub (cuenta de BE Group): **New repository** → nombre, por ejemplo `agente-begroup` → **Private** → **Create repository**.
2. En el repositorio vacío: **uploading an existing file** (o **Add file → Upload files**) y **arrastrar la carpeta `Github` completa**. Así el repositorio queda con una carpeta `Github/` adentro, y Vercel la lee desde ahí (paso 4).
3. Antes de confirmar, revisar que **no** se suba la carpeta `node_modules` ni ningún archivo `.env` con claves. `.env.example` sí se sube: no tiene valores.
4. **Commit changes**.

La carpeta `agente-begroup` (pruebas y herramientas) **no** se sube.

### 4. Vercel

1. En la cuenta Vercel de BE Group: **Add New → Project** → conectar GitHub → **Import** el repositorio.
2. En la configuración del proyecto:
   - **Root Directory**: **Edit** → elegir `Github` (escrito exactamente así).
   - **Framework Preset**: **Other**. No hace falta comando de build.
3. **Environment Variables**: cargar las que ya se tienen. Las de WhatsApp y notificaciones se agregan después (pasos 5 y 7).

| Variable | De dónde sale | Cuándo |
| --- | --- | --- |
| `APPS_SCRIPT_URL` | Paso 1.6 | Ahora |
| `APPS_SCRIPT_CLAVE` | La misma `CLAVE` del paso 1.3 | Ahora |
| `GEMINI_API_KEY` | Paso 2 | Ahora |
| `PANEL_PASSWORD` | Inventada (paso 0) | Ahora |
| `PANEL_PASSWORD_DUENO` | Inventada (paso 0) | Ahora |
| `CRON_SECRET` | Inventada (paso 0) | Ahora |
| `WHATSAPP_VERIFY_TOKEN` | Inventada (paso 0) | Ahora |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Panel → Estado → Generar claves de notificación | Paso 5 |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET` | Meta | Paso 7 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Opcionales (ver "Telegram") | — |

4. **Deploy**. Al terminar, la dirección del panel es `https://<proyecto>.vercel.app` (se ve en el proyecto, botón **Visit**).

> **Regla de oro:** cada vez que se agrega o cambia una variable, ir a **Deployments → … (del último) → Redeploy**. Sin eso, el cambio no se aplica.

> **Cron (seguimiento del Villa):** `vercel.json` viene con `"0 12 * * *"` (una vez al día) para que funcione en el plan Hobby. Con el plan **Pro**, cambiarlo a `"*/15 * * * *"` (paso 9) para que el Villa llegue a los 120 minutos.

### 5. Panel: inicializar, notificaciones y simulador

1. Abrir `https://<proyecto>.vercel.app` → perfil **Desarrollador** → `PANEL_PASSWORD`.
2. **Estado → Inicializar planilla.** Crea las pestañas técnicas (Mensajes, Mensajes emojis, Configuracion, Clientes, Conversaciones, Logs, Dispositivos y Accesos), carga los mensajes del flujo, agrega la columna **Palabras clave** a Preguntas frecuentes y 3 preguntas del documento de WhatsApp que faltaban (formas de pago, instalación, dónde ver los baños). No borra ni cambia nada más de las pestañas de BE Group. Se hace **una vez** por planilla.
3. En **Estado**, Google Sheets y Gemini deben quedar en verde. Notificaciones queda en rojo hasta el punto 4, y WhatsApp hasta el paso 7.
4. **Notificaciones al celular:** Estado → **Generar claves de notificación**. Copiar `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en Vercel → **Redeploy**. La privada es secreta. Estas claves no se cambian después: si se cambian, cada celular tiene que volver a activar los avisos.
5. **Forma de responder** (en Estado): **Original (con emojis)** o **Formal (sin emojis)**. Cada una tiene su pestaña de mensajes, así que cambiar no reescribe nada.
6. **Simulador:** probar las conversaciones de la tabla siguiente. Usa la planilla y Gemini reales, pero no envía nada por WhatsApp. "Nuevo cliente" empieza otra conversación.
7. Al terminar de probar: Estado → **Borrar chats de prueba** y Logs → **Borrar logs** (ver "Borrar logs y chats").

| Escribir en el simulador | Debería pasar |
| --- | --- |
| hola | Bienvenida con las opciones a, b, c |
| b | Los 3 mensajes del Villa |
| precio del btw | Solo el mensaje de precio y plazo del BTW |
| ¿hacen despacho a Puerto Montt? | Respuesta de Preguntas frecuentes |
| ¿y si llevo 3, cuánto sale? | No inventa un total: ofrece que lo llame un ejecutivo |
| quiero hablar con una persona | Pide nombre, teléfono y horario (y llega un aviso al celular, marcado "🧪 Prueba") |
| Juan Pérez, 912345678, mañana en la tarde | Confirma; el cliente aparece en Métricas → Por llamar |
| gracias por la información | "¡De nada! Lo que necesites, nos avisas" |
| ¿eres un bot? | Responde con honestidad que es un asistente virtual |
| ¿tienen el modelo XYZ? | Dice que no tiene ese dato y ofrece que lo llamen |

### 6. Celular de Carla (perfil Dueño)

**Instalar la app:**
- **Android (Chrome):** abrir `https://<proyecto>.vercel.app` → menú ⋮ → **Instalar app** (o **Agregar a la pantalla principal**).
- **iPhone (Safari):** abrir la misma dirección → botón **Compartir** → **Agregar a inicio**. En iPhone las notificaciones solo funcionan desde la app agregada a la pantalla de inicio (iOS 16.4 o superior).

**Primer ingreso:**
1. Abrir la app desde el ícono **BE Chats** → perfil **Dueño** → `PANEL_PASSWORD_DUENO`.
2. Aceptar **Entrar con Face ID** (iPhone) o **huella o rostro** (Android, Samsung). Desde ahí, al abrir la app se pide Face ID / huella en vez de la clave.
3. Tocar **Activar notificaciones** → Permitir.
4. Probar con **Cuenta → Enviar una prueba**: debe llegar un aviso.

El perfil Dueño solo ve **Chats**, **Simulador** y **Cuenta**. Más detalle en "Perfiles" y "App de chats".

### 7. Meta (WhatsApp Cloud API) con el número de prueba

Todo esto se hace dentro del **portafolio comercial de BE Group**. Las apps, números y cuentas de prueba creadas antes en cuentas personales no se traspasan: se crean de nuevo aquí.

**7.1 Crear la app**

1. [developers.facebook.com](https://developers.facebook.com) → **Mis apps → Crear app**.
2. Caso de uso: **Conectar con clientes a través de WhatsApp** → elegir el portafolio comercial de **BE Group** → **Crear app**.

**7.2 Número de prueba**

1. En la app → **WhatsApp → Configuración de la API** (o "Comenzar a usar la API"): Meta crea una cuenta de WhatsApp Business y entrega un **número de prueba**.
2. Copiar:
   - **Identificador del número de teléfono** → `WHATSAPP_PHONE_NUMBER_ID`.
   - **Identificador de la cuenta de WhatsApp Business** (WABA ID) → se usa en el punto 7.7.
3. En **Para** → **Administrar lista de números**: agregar los celulares que van a probar (máximo 5). A cada uno le llega un código por WhatsApp. El número de prueba solo le puede escribir a esos números.

**7.3 Clave secreta de la app**

**Configuración de la app → Básica → Clave secreta de la app → Mostrar** → `META_APP_SECRET`.

**7.4 Token permanente** (el de "Configuración de la API" vence en 24 horas: no usarlo)

1. [business.facebook.com](https://business.facebook.com) → **Configuración** → **Usuarios → Usuarios del sistema → Agregar**: nombre "Agente WhatsApp", rol **Administrador**.
2. **Asignar activos**:
   - **Apps** → la app → Control total.
   - **Cuentas de WhatsApp** → la cuenta → Control total.
3. **Generar token** → elegir la app → caducidad **Nunca** → permisos `business_management`, `whatsapp_business_messaging` y `whatsapp_business_management` → **Generar**.
4. Copiar el token (empieza con `EAA…`; se muestra una sola vez) → `WHATSAPP_TOKEN`.

**7.5 Cargar en Vercel**

Agregar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `META_APP_SECRET` → **Redeploy**. En el panel → Estado, el cuadro **WhatsApp** debe quedar en verde.

**7.6 Webhook** (por donde Meta le entrega los mensajes al bot)

1. En la app → **WhatsApp → Configuración** (en algunas cuentas aparece como "Paso 2: Configuración de producción") → **Webhook → Editar**:
   - **URL de devolución de llamada**: la que muestra el panel en Estado (`https://<proyecto>.vercel.app/api/webhook`).
   - **Token de verificación**: el mismo `WHATSAPP_VERIFY_TOKEN`.
   - **Verificar y guardar**.
2. Más abajo, en **Campos del webhook**: activar **Suscribirse** solo en **`messages`**. Los demás no se usan.

**7.7 Suscribir la cuenta de WhatsApp a la app.** Sin esto el webhook queda verificado pero los mensajes no llegan.

1. Abrir [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) (Graph API Explorer).
2. Arriba a la derecha:
   - **Aplicación de Meta**: la app.
   - **Token de acceso**: **Generate Access Token**, con el permiso `whatsapp_business_management`. También sirve pegar el `WHATSAPP_TOKEN`.
3. Cambiar **GET** por **POST** y escribir en la ruta: `<WABA ID>/subscribed_apps` (el WABA ID del punto 7.2).
4. **Enviar**. Debe responder `{"success": true}`.

**7.8 Publicar la app**

1. **Configuración de la app → Básica**:
   - **URL de la política de privacidad**: `https://<proyecto>.vercel.app/privacidad.html`.
   - **URL de eliminación de datos de usuario** (si la pide): `https://<proyecto>.vercel.app/privacidad.html#eliminar`.
   - **Categoría**: Empresa y páginas, o la más parecida.
   - **Ícono de la app**: opcional (`public/icono-512.png`).
   - **Guardar cambios**.
2. Arriba, cambiar el **Modo de la app** de Desarrollo a **Publicado** (Live). En modo desarrollo Meta no entrega los mensajes reales.
3. La política de privacidad es un borrador. BE Group debe revisarla (Ley 21.719) antes de usar el número real.

**7.9 Probar**

Desde un celular agregado en 7.2, escribir "hola" al número de prueba:
- Debe llegar la bienvenida.
- En el panel aparece el chat (pestaña WhatsApp), y quedan registros en Logs y Conversaciones.

Probar también "precio del villa" y "quiero hablar con una persona": debe llegar la notificación al celular de Carla. Si algo falla, ver "Problemas con Meta".

### 8. Número real (+56 9 5220 1795): solo en la API

Decisión: el número se usa **solo en la API**. Deja de funcionar en la app WhatsApp Business del teléfono, y Carla atiende desde la app de chats del panel. La coexistencia (app y API a la vez) solo la puede activar un Solution Partner o Tech Provider de Meta.

Hacerlo **después** de probar todo con el número de prueba, en un horario con pocos mensajes:

1. En el teléfono, **respaldar o exportar** los chats importantes de WhatsApp Business: al eliminar la cuenta se pierde el historial. Anotar el PIN de verificación en dos pasos si tiene uno (Ajustes → Cuenta → Verificación en dos pasos).
2. En la app: **Ajustes → Cuenta → Eliminar cuenta**. El número sigue funcionando para llamadas y SMS. Esperar unos **3 minutos** a que Meta lo libere.
3. En la app de Meta → **WhatsApp → Configuración de la API → Agregar número de teléfono**:
   - Nombre visible: **BE Group** (Meta lo revisa).
   - Categoría.
   - Verificar con el código que llega por **SMS o llamada** al número.
4. Copiar el **Identificador del número de teléfono** del número real en `WHATSAPP_PHONE_NUMBER_ID` en Vercel → **Redeploy**.
5. En el panel → Estado → **Registrar número en WhatsApp (PIN)**: escribir el PIN de 6 dígitos del paso 1, o inventar uno nuevo si no tenía, y guardarlo. Meta exige este registro y permite máximo 10 intentos cada 72 horas.
6. **business.facebook.com → Facturación (Billing Hub) → Método de pago**: agregar una tarjeta.
   - Desde el 1 de octubre de 2026, cada número tiene **1.000 mensajes de respuesta gratis al mes**; desde el 1.001 se cobran.
   - Sin medio de pago, Meta deja de entregar los mensajes.
   - Las respuestas a clientes que llegan desde un anuncio de Facebook o Instagram con botón de WhatsApp son gratis durante 7 días.
7. Escribir desde **cualquier** celular (ya no hay lista de destinatarios) al número real y revisar el panel.

### 9. Dejarlo listo para producción

- [ ] Vercel en plan **Pro** y `vercel.json` con `"schedule": "*/15 * * * *"` (subir el archivo a GitHub; Vercel se actualiza solo).
- [ ] Facturación de Gemini activada (paso 2.3).
- [ ] Método de pago en Meta (paso 8.6).
- [ ] App de Meta en modo **Publicado** y política de privacidad revisada por BE Group.
- [ ] Panel → Estado, todo en verde.
- [ ] **Borrar chats de prueba** y **Borrar logs**, para que las métricas partan de cero.
- [ ] Carla con la app instalada, Face ID y notificaciones activas, y una prueba recibida.
- [ ] Claves guardadas en el gestor de contraseñas de BE Group.

---

## Actualizar el código más adelante

| Qué cambió | Qué hacer |
| --- | --- |
| Archivos de `Github/` (api, lib, public, vercel.json) | En GitHub, entrar a la carpeta `Github` → **Add file → Upload files** → arrastrar los archivos o carpetas cambiados → **Commit**. Vercel publica solo en 1 a 2 minutos. |
| `apps-script/Codigo.gs` | Además, pegarlo en la planilla y publicar **nueva versión** (paso 1, recuadro "Si algún día cambia"). |
| Pestañas o columnas técnicas nuevas | Presionar **Inicializar planilla** otra vez. Es seguro: no borra datos, solo agrega lo que falta. |
| Una variable de Vercel | **Redeploy**. |

Subir código **no** requiere volver a inicializar la planilla.

## Borrar logs y chats

Solo el perfil **Desarrollador** puede borrar. Lo borrado se elimina de la planilla y **no se puede deshacer**: si se quiere guardar algo, antes descargar la planilla (Archivo → Descargar → Excel).

| Botón | Dónde | Qué borra |
| --- | --- | --- |
| **Borrar logs** | Pestaña Logs, arriba | Todas las filas de la pestaña Logs (queda el encabezado) |
| **Borrar chats de prueba** | Estado → Acciones | Las conversaciones del Simulador (`SIM-…`) y las del número de prueba de Meta (16315551181): filas de Clientes, Conversaciones y Logs |
| **Eliminar chat** | Pestaña WhatsApp → abrir un chat → ⓘ (ficha) → abajo | Ese cliente: su fila en Clientes, todos sus mensajes en Conversaciones y sus Logs |

**Eliminar chat** también sirve para cumplir cuando un cliente pide que eliminen sus datos (política de privacidad). Si el cliente vuelve a escribir, empieza como contacto nuevo.

Requiere el Apps Script versión 2 o superior (la que viene en `apps-script/Codigo.gs`). Con uno más antiguo, el panel avisa que hay que volver a pegarlo y publicar una nueva versión.

---

## La planilla

| Pestañas | De quién son | Para qué |
| --- | --- | --- |
| Léeme, Empresa, Productos, Elegir modelo, Precios, Preguntas frecuentes, Proyectos, Derivación, Contacto, Videos y descargas (y cualquier otra que agreguen) | BE Group | Base de conocimiento. La IA solo responde con lo que está aquí, y las reglas de **Léeme** son obligatorias para ella. |
| Mensajes, Mensajes emojis | BE Group (las crea el panel) | Mensajes fijos del flujo, uno por cada forma de responder: bienvenida, los 3 de cada modelo, confirmaciones |
| Configuracion | BE Group (la crea el panel) | Interruptor del bot, forma de responder, minutos del seguimiento, horas de pausa, etc. |
| Clientes, Conversaciones, Logs | El bot | Registro de cada cliente, todos los mensajes y los eventos técnicos. No editar a mano. |
| Dispositivos, Accesos | El bot | Celulares con notificaciones y llaves de Face ID / huella. Para quitarle el acceso a un celular, poner `no` en la columna `activo`. |

Reglas de lectura:
- Las filas que tengan una celda que empiece con **"Por confirmar"** o **"Pendiente"** no se usan. El color amarillo por sí solo no basta: hay que escribir el texto.
- En **Precios**, solo se usan las filas con **Estado = Vigente**.
- Se pueden agregar pestañas o columnas nuevas de conocimiento; el bot las lee solo. Lo que no hay que cambiar son los nombres de las pestañas técnicas.

## Editar el contenido (BE Group)

Todo se edita en la planilla y se aplica en menos de 1 minuto, sin tocar el código:

- **Pestañas de conocimiento** (Productos, Precios, Preguntas frecuentes…): se editan como siempre. Para desactivar una fila, escribir "Por confirmar" en alguna de sus celdas.
- **Mensajes** y **Mensajes emojis**: bienvenida, los 3 mensajes de cada modelo, confirmaciones. No cambiar la columna `clave`. `datos_recibidos` acepta `{nombre}`, `{telefono}` y `{horario}`.
  Para que el bot no repita siempre lo mismo, una celda puede tener **varias versiones** separadas por una línea que diga solo `---`. En cada chat se van alternando en orden. Ya vienen así `sin_informacion` (4 versiones), `pedir_datos` y `ya_derivado` (3 cada una).
  **Mensajes** es la forma Formal (sin emojis) y **Mensajes emojis** la Original (los textos del documento de BE Group). En **Estado → Forma de responder** se elige cuál se usa, y la IA ajusta su tono. **Restaurar mensajes** vuelve a poner los textos originales del código en las dos pestañas.
- **Configuracion**: `bot_activo` (interruptor general), `estilo`, minutos para el seguimiento del Villa, horas de pausa, etc.

**Si cambia un precio, hay que cambiarlo en tres lugares:** la pestaña **Precios** y el mensaje `*_3` del modelo en **Mensajes** y en **Mensajes emojis** (por ejemplo `VILLA_3`). El validador acepta cualquier monto que aparezca en la planilla, así que un precio viejo olvidado en Mensajes seguiría siendo "válido". Para evitarlo, el panel marca Google Sheets en rojo cuando un monto de Mensajes no aparece en ninguna pestaña de BE Group.

## Cómo responde

| Situación | Qué hace | ¿Usa IA? |
| --- | --- | --- |
| Contacto nuevo | Mensaje de bienvenida (opciones a, b, c) + aviso de asistente virtual | No |
| Contacto nuevo que solo saluda o pide "info" | Solo la bienvenida | No |
| Responde a, b o c, o "me interesa el Villa" | Los 3 mensajes del modelo: cómo funciona, videos, precio y plazo | No |
| "precio del Villa", "¿cómo funciona el BTW?", "¿tienen videos?" | Solo esa parte del modelo (ver tabla abajo) | No |
| Pregunta que calza con Preguntas frecuentes | Su "Respuesta aprobada", tal cual | No |
| "Quiero hablar con una persona", "¿me pueden llamar?" | Pide nombre, teléfono y horario + aviso al celular de Carla | No |
| No responde después de la bienvenida | A los 120 minutos envía los 3 mensajes del Villa (configurable) | No |
| "Gracias por la información" | "¡De nada! Lo que necesites, nos avisas" | No |
| Audio o sticker | "Este WhatsApp solo recibe mensajes de texto…" | No |
| Foto, video o documento | Acusa recibo y pide que escriba qué necesita (útil en postventa) | No |
| Otra pregunta cubierta por la planilla | Responde con Gemini, usando solo las pestañas de BE Group y nombrando el modelo del que habla | Sí |
| Situación de la hoja Derivación (cotización, negociación, institucional, postventa, sin respuesta) | Pide nombre, teléfono y horario; con los datos avisa al celular de Carla con el motivo | Sí |
| Menciona email, comuna, tipo de uso, cantidad o plazo | Lo guarda en Clientes | Sí |
| La IA menciona un precio o % que no está en la planilla | No lo envía: deriva al ejecutivo y deja un WARN en Logs | — |
| Carla responde desde la app de chats | Le llega al cliente por WhatsApp y el bot se calla 12 horas en ese chat ("Reactivar bot" lo devuelve antes) | — |

**Sobre los modelos**, el bot envía solo lo que el cliente pide, sin consultar a Gemini:

| El cliente escribe | Recibe |
| --- | --- |
| "b", "el villa", "me interesa el Villa" (elige el modelo) | Los 3 mensajes del modelo |
| "precio del Villa", "¿cuánto cuesta?" | Solo el mensaje de precio y plazo |
| "¿cómo funciona el BTW?", "características" | Solo el mensaje de cómo funciona |
| "¿tienen videos?", "¿cómo se usa / se instala?" | Solo los videos |
| "más información del Villa", "cuéntame del Tiny" | Cómo funciona + videos |

Si no nombra el modelo ("¿y cuánto cuesta?"), se usa el último del que habló. Si el mensaje trae algo más (cantidades, dos modelos, otra pregunta), responde la IA, con la instrucción de contestar solo lo que se preguntó.

**Respuestas sin IA (Preguntas frecuentes).** Cada pregunta se reconoce por la columna **Palabras clave**, separadas por comas:

| Escrito | Calza con |
| --- | --- |
| `garantia` | la palabra completa (tildes y mayúsculas dan lo mismo) |
| `despach*` | palabras que empiezan así: despacho, despachan… |
| `cada cuanto se vacia` | la frase seguida |
| `envio* + region*` | ambas, en cualquier parte del mensaje |
| `!caseta` | en preguntas de un modelo (Tema BTW, Villa, WKN Prime o Tiny), basta esa palabra aunque el cliente no nombre el modelo |

Para agregar una respuesta fija, BE Group agrega una fila con la pregunta, la respuesta aprobada y sus palabras clave. Para no equivocarse, decide la IA cuando el mensaje es largo, tiene números (fechas, cantidades, teléfonos), habla de precios, compras o reclamos, o calza con dos preguntas o más.

## Perfiles: Dueño y Desarrollador

| Perfil | Clave | Ve |
| --- | --- | --- |
| **Dueño** | `PANEL_PASSWORD_DUENO` | Solo **Chats** (WhatsApp), **Simulador** y **Cuenta**, con diseño para celular y pestañas abajo |
| **Desarrollador** | `PANEL_PASSWORD` | Todo: métricas, estado, simulador, logs, clientes, conversaciones, chats y los botones de borrar |

- Los permisos se revisan también en el servidor: con la sesión del dueño no se pueden ver métricas, estado ni logs, ni inicializar o borrar.
- Al entrar se entrega una sesión firmada de 30 días; la clave no queda guardada en el celular.
- Si se cambia cualquiera de las dos claves en Vercel (+ Redeploy), todas las sesiones abiertas se cierran.

**Face ID / huella:**
- Usa llaves de acceso (passkeys, estándar WebAuthn). La cara o la huella nunca salen del celular; en la pestaña **Accesos** solo queda la llave pública de cada celular.
- Las llaves quedan atadas a la dirección del panel: si cambia el dominio en Vercel, hay que volver a activarlas.
- Requiere iOS 16 o superior, o Android 9 o superior con bloqueo de pantalla.

## App de chats

La pestaña **WhatsApp** es la bandeja de conversaciones:
- Lista de chats con filtros: Sin leer, Piden persona, Por llamar y Pruebas.
- Cada conversación completa: cliente, bot y lo que escribió Carla.
- Un cuadro para responder. Al responder, el mensaje le llega al cliente por WhatsApp y el bot se pausa en ese chat por 12 horas (se cambia en Configuracion). **Reactivar bot** lo devuelve antes.
- El botón ⓘ muestra la ficha del cliente, los botones Venta / Sin venta y, para el desarrollador, **Eliminar chat**.
- Se actualiza sola cada pocos segundos.

**Cuándo llega un aviso al celular:**
- Cuando un cliente pide hablar con una persona o algo que requiere un ejecutivo (comprar, cotizar, negociar, postventa).
- Otra vez cuando deja nombre, teléfono y horario ("llamar a …").

Las demás conversaciones las atiende el bot sin avisar. Tocar el aviso abre ese chat.

**Límites:**
- WhatsApp solo deja escribirle a un cliente hasta 24 horas después de su último mensaje. Pasado ese plazo, la app lo indica y hay que llamarlo (botón 📞).
- Solo se envía texto.

## Métricas y ventas

La pestaña **Métricas** muestra:
- **Personas que escribieron**, **respondidas por el bot**, **pendientes**, **ventas** con su % de conversión y el **tiempo de respuesta** mediano.
- **Embudo**: escribieron → respondidos → eligieron modelo → pidieron que los llamen → venta.
- **Personas por día** de los últimos 14 días.
- Pendientes:
  - **Por llamar**: dejaron nombre, teléfono y horario.
  - **Sin respuesta**: su último mensaje lleva más de 5 minutos sin contestar.
  - **Datos incompletos**: el bot les pidió los datos y faltan algunos.
- **Por modelo**: interesados, ventas y conversión.

Las pruebas del Simulador **no** se cuentan en las métricas, para no mezclarlas con clientes reales (sí aparecen en la app de chats, filtro Pruebas).

El bot no puede saber cuándo se concreta una venta, así que se marca a mano con **Venta** / **Sin venta**. Se puede hacer en Métricas, en Clientes o en la ficha ⓘ de la app de chats; **Deshacer** lo borra. Al marcarla, el cliente sale de las listas de pendientes.

## Tiempos de respuesta

| Caso | Tiempo aproximado |
| --- | --- |
| Respuestas sin IA (bienvenida, a/b/c, precios, preguntas frecuentes) | 2 a 4 segundos |
| Respuesta con Gemini | 4 a 10 segundos |
| Primer mensaje después de un rato sin uso | 1 a 3 segundos extra |

**Medir Gemini:** panel → **Estado → Probar velocidad de Gemini**. Compara:
- El modelo principal: `GEMINI_MODEL`, por defecto `gemini-3.5-flash-lite`.
- El de respaldo: `GEMINI_MODEL_RESPALDO`, por defecto `gemini-3.6-flash`.

Si el principal no responde en 18 segundos o está saturado, el bot reintenta solo con el de respaldo y deja `gemini_lento` en Logs. Cada respuesta queda medida en Logs (evento `respondido`).

## Revisar problemas

### En el panel (pestaña Logs, filtrar por ERROR o WARN)

| Evento | Qué significa | Qué hacer |
| --- | --- | --- |
| `firma_invalida` | El webhook no pudo verificar que el mensaje viene de Meta | Revisar `META_APP_SECRET` (+ Redeploy) |
| `webhook_verificacion_fallida` | Meta no pudo verificar la URL | `WHATSAPP_VERIFY_TOKEN` en Vercel distinto al escrito en Meta, o falta el Redeploy |
| `gemini_error` | Gemini no respondió | Revisar `GEMINI_API_KEY`, facturación o cuota |
| `gemini_lento` | Respondió el modelo de respaldo | Si se repite, cambiar `GEMINI_MODEL` |
| `respuesta_bloqueada` | La IA quiso dar un precio que no está en la planilla | Normal. Si se repite, agregar esa información a Preguntas frecuentes |
| `envio_fallido` / `error_procesando` | WhatsApp no entregó un mensaje | Ver el código en la tabla siguiente |
| `error_guardando_planilla` | No se pudo escribir en la planilla | Revisar que el Apps Script siga implementado y que `APPS_SCRIPT_CLAVE` sea igual a `CLAVE` |
| `bot_en_pausa` | Una persona está atendiendo ese chat | Se reactiva con **Reactivar bot** |

Los logs detallados de cada ejecución están en Vercel → proyecto → **Logs**.

### Problemas con Meta

| Síntoma o código | Causa | Solución |
| --- | --- | --- |
| Escribo al número y en Logs no aparece nada | Los mensajes no llegan al bot | Revisar, en orden: webhook verificado (7.6), `messages` suscrito (7.6), cuenta suscrita a la app (7.7), app **Publicada** (7.8) |
| 131030 "Recipient not in allowed list" | Con el número de prueba, el celular no está en la lista | Agregarlo en Configuración de la API → Para (7.2) |
| 131031 "Business Account locked" | Meta bloqueó la cuenta de WhatsApp Business (suele pasar en cuentas nuevas o personales con mucha actividad de prueba) | No es del código. Revisar avisos en business.facebook.com → Seguridad / Calidad de la cuenta y pedir revisión. No crear cuentas nuevas para "saltarlo" |
| 131047 | Pasaron más de 24 h desde el último mensaje del cliente | Llamarlo |
| 190 | Token vencido o inválido | Generar de nuevo el token permanente (7.4) |
| 133005 / 133016 al registrar el número | PIN incorrecto / demasiados intentos | Usar el PIN de verificación en dos pasos; esperar 72 h si se agotaron los intentos |
| El chat aparece en el panel pero no llega al celular del cliente | Meta recibió pero no entregó | Mirar el `envio_fallido` en Logs y su código |

## Telegram (opcional)

La app de chats reemplaza a Telegram. Configurarlo solo si además se quiere una copia de cada conversación en un grupo:
1. En Telegram, **@BotFather** → `/newbot` → guardar el token (`TELEGRAM_BOT_TOKEN`).
2. Crear un grupo, agregar el bot y escribir un mensaje.
3. Panel → Estado → **Buscar chat de Telegram** → copiar el número en `TELEGRAM_CHAT_ID` → Redeploy → **Probar alerta de Telegram** → **Conectar respuestas por Telegram**.

Para responder desde Telegram: **Responder** sobre el mensaje del cliente. `/bot` devuelve el chat al bot; `/venta`, `/perdido` y `/abierto` marcan el resultado.

## Archivos

```
api/webhook.js       recibe los mensajes de WhatsApp (URL que se pone en Meta)
api/seguimiento.js   envío automático del Villa (cron de Vercel)
api/panel.js         datos y acciones del panel (con permisos por perfil)
api/telegram.js      respuestas desde Telegram (opcional)
lib/                 lógica del bot, planilla, Gemini, WhatsApp, notificaciones, sesiones, validador de precios
lib/seed.js          mensajes del flujo (formal y con emojis) y configuración inicial
lib/respuestas-fijas.js  respuestas sin IA (palabras clave)
apps-script/Codigo.gs    script "puente" que se pega en la planilla (versión 2)
public/index.html    panel y app de chats
public/privacidad.html   política de privacidad (borrador para revisar)
public/sw.js, manifest.webmanifest, icono-*.png  app instalable y notificaciones (para cambiar el ícono, reemplazar los icono-*.png con el mismo nombre)
vercel.json          duración de las funciones y horario del cron
.env.example         lista de variables (sin valores)
```

Las claves **nunca** van en el código: se cargan en Vercel como variables de entorno.

## Pruebas automáticas

Las pruebas (con servicios simulados y una copia de la planilla) y las herramientas de terminal están en la carpeta de desarrollo `agente-begroup`, que no se sube a GitHub.
