# Alertas WhatsApp - Alertas sanitarias INVIMA HDV

Bot de Google Apps Script (`alertas-sanitarias-invima-hdv`) del Servicio Farmacéutico del Hospital Departamental de Villavicencio E.S.E. Revisa los listados de alertas sanitarias e informes de seguridad de INVIMA (medicamentos y dispositivos médicos), los clasifica según su relevancia para el HDV y publica las relevantes en el grupo de WhatsApp vía [GREEN-API](https://green-api.com/).

Proyecto hermano de [alertas-whatsapp-farmacovigilancia](https://github.com/jsaavedran1-glitch/alertas-whatsapp-farmacovigilancia): misma instancia GREEN-API (`710722693364`), Script Properties independientes.

## Arquitectura

- **Proyecto:** Apps Script independiente (standalone), propiedad de `controldecalidadgases@hdv.gov.co`. Sin clasp (misma convención que el bot de Farmacovigilancia): el código se copia de `Codigo.gs` al editor.
- **Hoja de control:** Google Sheets indicada en `SS_ID`.
- **Fuentes:** HTML del servidor (Drupal Views) de `app.invima.gov.co/alertas/...`. Cada página trae 8 ítems. En operación normal se lee `?page=0` y, solo si toda la página es nueva, la siguiente (hasta 3 páginas), para no perder alertas cuando INVIMA publica más de 8 el mismo día (el 19/10/2026 publicó 9 de dispositivos).
- **Disparadores:** `revisarAlertas` diario a las 6, 10, 14 y 18 h; `resumenSemanal` los lunes a las 7 h (America/Bogota, ±15 min).

```mermaid
flowchart TD
    A["Disparador (6/10/14/18 h)"] --> B["revisarAlertas()"]
    B --> C["LockService"]
    C --> D["Config_Fuentes → UrlFetchApp ?page=0"]
    D --> E["parsearListado_(html, fuente)"]
    E -->|0 ítems| F["Log + aviso técnico (1 por día)"]
    E --> G["Descarta claves ya en Historico"]
    G --> H["clasificar_: Listado_Terapeutico / Vigilancia / Reglas"]
    H -->|ALTA / MEDIA| I["Historico = PENDIENTE → GREEN-API → SI / ERROR / NO_ENVIADO_466"]
    H -->|BAJA| J["Historico = RESUMEN_SEMANAL"]
    J --> K["resumenSemanal() lunes 7 h"]
    I --> L["Grupo WhatsApp (GA_CHAT_ID)"]
    K --> L
    style L fill:#1b2a4a,color:#fff
```

## Archivos

| Archivo | Descripción |
|---|---|
| `Codigo.gs` | Lógica completa del bot. |
| `appsscript.json` | Manifiesto: `America/Bogota`, V8, scopes mínimos (`script.external_request`, `spreadsheets`, `script.scriptapp`). |
| `test/dry-run.js` | Pruebas en Node.js con servicios de Apps Script simulados y HTML real de ejemplo. Sin red ni credenciales. |
| `package.json` | `npm test` ejecuta `test/dry-run.js` (usado por el workflow Node.js CI). |
| `CLAUDE.md` | Reglas operativas para asistentes de IA. |
| `CHANGELOG.md` | Historial de cambios. |

## Propiedades del script requeridas

Configuración del proyecto → Propiedades de las secuencias de comandos:

| Propiedad | Descripción |
|---|---|
| `GA_API_URL` | URL base de la instancia GREEN-API (p. ej. `https://7107.api.greenapi.com`). |
| `GA_ID` | ID de la instancia (`710722693364`). |
| `GA_TOKEN` | Token de la instancia. **Secreto: no versionar, no compartir.** |
| `GA_CHAT_ID` | chatId del grupo destino (debe terminar en `@g.us`; el código bloquea cualquier otro). Durante las pruebas: grupo "PRUEBA BOT". En producción: grupo "HDV-Nuevo servicio". |
| `GA_MEDIA_URL` | Recomendada. Servidor de medios de GREEN-API para `sendFileByUpload`: copiar el valor **mediaUrl** de la instancia en la consola de GREEN-API (en la instancia `710722693364` es `https://7107.api.greenapi.com`, verificado el 20/10/2026). Si falta, se intenta `GA_API_URL` con `media` en lugar de `api` y, si ese servidor no existe, el propio `GA_API_URL`. |
| `SS_ID` | ID de la hoja de control (`1rN_yIfqk1388zqUBr-P0zfbTBiSVlDDl-D44INlXsgo`). |

`ULTIMO_AVISO_TECNICO` la crea el bot (fecha del último aviso de listado ilegible).

## Despliegue y orden de ejecución inicial

1. En [script.google.com](https://script.google.com) con `controldecalidadgases@hdv.gov.co`, abrir el proyecto `alertas-sanitarias-invima-hdv`.
2. Mostrar `appsscript.json` (Configuración del proyecto) y pegar su contenido; pegar `Codigo.gs`. Guardar.
3. Cargar las propiedades del script (tabla anterior), con `GA_CHAT_ID` = PRUEBA BOT.
4. Ejecutar, en este orden, verificando en el selector la función antes de pulsar "Ejecutar":
   1. **`inicializarHoja()`**: crea las pestañas con encabezados; precarga `Config_Fuentes` y `Reglas`. No modifica pestañas que ya tienen datos.
   2. Cargar `Listado_Terapeutico` y `Vigilancia` en la hoja.
   3. **`cargaInicial()`**: lee 5 páginas por fuente y llena el `Historico` con `enviado = CARGA_INICIAL`, **sin enviar mensajes**. Evita que el primer día se disparen alertas viejas. **Obligatorio antes de activar disparadores.**
   4. **`probarSinEnviar()`** (y, si quiere ver el formato con alertas ya registradas, **`vistaPrevia()`**): ejecuta todo el flujo y escribe los mensajes en el registro de ejecución (`[SIMULADO - no enviado]`), sin enviar ni escribir en `Historico`. Incluye el texto del resumen semanal.
   5. **`instalarDisparadores()`**: borra los disparadores del proyecto y crea los del bot.
5. Pasar a producción: cambiar `GA_CHAT_ID` al grupo "HDV-Nuevo servicio" (solo con autorización explícita del referente).

## Hoja de control

| Pestaña | Columnas | Quién la llena |
|---|---|---|
| `Config_Fuentes` | fuente, url, activa | Precargada (MED, DM). Editable. |
| `Historico` | clave, fuente, numero, anio, titulo, tipo, fecha_publicada, url_pdf, fecha_deteccion, nivel, coincidencia, enviado | El bot. |
| `Listado_Terapeutico` | codigo, descripcion, principio_activo, marca, tipo (MED/DM), subgrupo, lote, laboratorio | Cargado desde `DTSUMINISTRO` (ver abajo). Editable. |
| `Aux_Productos` | Productos distintos y pares producto–LoteSerial de `DTSUMINISTRO`, con laboratorio y lote separados | Fórmulas. No borrar: `Listado_Terapeutico` lee de aquí lote y laboratorio. |
| `Reglas` | termino, nivel (ALTA/MEDIA/BAJA), motivo | Precargada: términos MEDIA/BAJA y 53 marcas comerciales de medicamentos de uso frecuente (ALTA, motivo "Uso frecuente"). Editable. |
| `Vigilancia` | principio_activo, motivo | Precargada con antimicrobianos PROA y medicamentos de control especial del catálogo. Editable. |
| `Log` | fecha, fuente, leidos, nuevos, enviados, estado, error | El bot. |

### Listado Terapéutico de Medicamentos y Dispositivos Médicos (desde `DTSUMINISTRO`)

- **codigo, descripcion, subgrupo:** productos distintos dispensados (pestaña `DTSUMINISTRO`, 1.212 productos: 503 MED, 709 DM).
- **principio_activo (MED):** texto de `NombreProducto` antes de la concentración o forma farmacéutica, sin sales; combinaciones con `+` o `/` (p. ej. `PIPERACILINA/TAZOBACTAM`), que el bot separa en términos.
- **principio_activo (DM):** nombre genérico del dispositivo (`CATETER`, `SONDA`, `SUTURA`…). **marca:** marcas comerciales reconocibles (`AQUACEL`, `PROLENE`, `BUSCAPINA`…).
- **lote y laboratorio:** fórmulas (`BYROW`) sobre `Aux_Productos`, que separa `LoteSerial` (`LABORATORIO-LOTE-...`). Se actualizan solas si se reemplaza el contenido de `DTSUMINISTRO`. Los productos nuevos de un mes posterior sí deben agregarse como filas en `Listado_Terapeutico`.
- El bot ignora lotes de menos de 5 caracteres o sin dígitos y prefijos genéricos de laboratorio (`GLOBAL`, `LIFE`, `AMERICAN`…; lista `LABORATORIOS_GENERICOS` en `Codigo.gs`).

Valores de `enviado`: `SI`, `PENDIENTE` (se escribe antes de enviar), `ERROR`, `NO_ENVIADO_466`, `RESUMEN_SEMANAL` (BAJA), `CARGA_INICIAL`. Ninguna clave se reintenta: si queda `ERROR` o `NO_ENVIADO_466`, revisarla manualmente.

## Reglas de negocio

- **Clave única:** `FUENTE:TIPO:NUMERO-AÑO`, con TIPO `AS` (alerta sanitaria) o `IS` (informe de seguridad), p. ej. `MED:AS:330-2026`, `DM:IS:148-2026`. El número se extrae del nombre del PDF (`No_ #355-2026`). Si no hay número, la clave es `FUENTE:url_pdf`.
- **La fecha del listado no es confiable** (alertas 2026 con fecha 2016-10-14): nunca se filtra por fecha.
- **Clasificación** (mayúsculas, sin tildes, por palabras completas, sobre el título):
  - 🔴 **ALTA:** coincide con `principio_activo`, `marca` o un **lote dispensado** de `Listado_Terapeutico` (del mismo tipo MED/DM, o sin tipo), con `Vigilancia`, o con una regla ALTA (p. ej. una marca comercial de uso frecuente: `Uso frecuente: OZEMPIC`). La coincidencia por lote se muestra primero: `Lote F0537A dispensado en HDV: ...`.
  - ⚪ **BAJA:** contiene un término BAJA y no tiene coincidencias ALTA.
  - 🟠 **MEDIA:** contiene un término MEDIA, es un informe de seguridad, o nombra un **laboratorio proveedor** del HDV (`Laboratorio proveedor HDV: GENFAR`).
  - ⚪ **BAJA:** el resto.
  - En el Listado Terapéutico y en Vigilancia se ignoran términos de menos de 4 caracteres (evita falsos positivos). En `Reglas` no hay mínimo (p. ej. `CBD`).
  - Se toleran plurales (`CATÉTERES` coincide con `CATETER`).
  - La coincidencia muestra un renglón por término encontrado, el más específico primero, con un producto de ejemplo: `ENDOTRAQUEAL: TUBO ENDOTRAQUEAL Nº 3.0 SIN NEUMO (UT1518020014356) y 18 más`.
  - En `principio_activo` se pueden poner varios términos separados por `;` (p. ej. `PLACA DE OSTEOSINTESIS; PLACA BLOQUEADA`). Use términos específicos: una palabra suelta como `PLACA` o `BALON` coincide también con "placas de Petri" o "tubo con balón".
  - La coincidencia es solo sobre el **título** del listado: si INVIMA nombra el lote únicamente dentro del PDF, no se detecta (esta versión no lee PDF).
- **Envío:** ALTA y MEDIA de inmediato (ALTA primero), 2 s entre mensajes, máximo 10 por ejecución; si hay más, un único mensaje agrupado `[INVIMA]`. BAJA solo en el resumen semanal.
- **Contacto para dudas:** cada alerta termina con `❓ Dudas: QF Juan Pablo Saavedra HDV · https://wa.me/573245844408` (`CONTACTO_DUDAS`): el enlace abre el chat del QF, sin envío ni consumo de cuota.
- **Listado ilegible** (HTTP ≠ 200 o 0 ítems en `page=0`): fila de error en `Log` y un aviso `[INVIMA] ⚠️ No se pudo leer el listado` como máximo una vez al día.
- **Foto del producto (solo MED):** cada alerta individual de medicamentos se envía como la foto del producto extraída del PDF (el JPEG más grande ≥ 15 KB, sin las franjas de encabezado) con el texto completo de la alerta al pie (`sendFileByUpload`, al servidor de medios `GA_MEDIA_URL` o, si no existe, el de `GA_API_URL` con `media` en lugar de `api`). Si el PDF no descarga, no trae foto, el texto pasa de 1.024 caracteres o el envío de la foto falla (salvo 466), sale como texto. Cuenta como un mensaje. DM siempre como texto: sus PDF solo traen las imágenes de la plantilla (diagnóstico del 20/10/2026: MED 39 de 40 con foto, DM 0 de 26). Se desactiva con `FOTO_EN_ALERTAS = false`.
- **GREEN-API:** solo `sendMessage` y `sendFileByUpload` a `GA_CHAT_ID`. No se usan `checkWhatsapp` ni `getContacts`. Ante HTTP 466 (cuota) se registra en `Log` y no se intenta ningún otro envío en esa ejecución.

## Formato del mensaje

Usa el formato de WhatsApp (`*negrita*`, `_cursiva_`, viñetas) y emojis (generados con `String.fromCodePoint`).

```
[INVIMA-DM] 🔴 *PRIORIDAD ALTA* · 🩺 Dispositivo médico
*Informe de seguridad No. 149-2026*

📌 Cementos óseos con gentamicina Heraeus® ... PALACOS® R+G...
📅 Publicada: 2026-10-19
🆔 ID INVIMA: DI2609-00541 · Estado: SEGUIMIENTO      (solo DM)

🏥 *Coincidencia HDV:*                                 (si aplica)
• CEMENTO OSEO: CEMENTO OSEO ALTA VISCOCIDAD ... y 1 más
• Vigilancia: GENTAMICINA

📄 PDF: https://app.invima.gov.co/alertas/ckfinder/userfiles/files/...
❓ Dudas: QF Juan Pablo Saavedra HDV · https://wa.me/573245844408

_Bot Alertas INVIMA · Servicio Farmacéutico HDV_
```

- Medicamentos: `💊 Medicamento`; dispositivos: `🩺 Dispositivo médico`. Nivel: 🔴 ALTA, 🟠 MEDIA, ⚪ BAJA.
- El título se muestra sin "Alerta sanitaria sobre:" (ya va en el encabezado).
- Si el año de la fecha del listado no coincide con el de la alerta (fechas erradas de INVIMA), se muestra `📅 Detectada: <fecha>` en lugar de `Publicada`.
- El resumen semanal y el mensaje agrupado siguen el mismo estilo.

## Cómo agregar fuentes o reglas

- **Fuente nueva:** agregar una fila en `Config_Fuentes` (`fuente` corta en mayúsculas, p. ej. `COS`; `url` del listado sin `?page`; `activa` = `SI`). El prefijo del mensaje será `[INVIMA-COS]`. Antes, comprobar el listado con `probarAcceso()`/`volcarMuestraHtml()` y ejecutar `cargaInicial()` para no disparar el histórico de esa fuente. Para desactivar una fuente: `activa` = `NO`.
- **Regla nueva:** fila en `Reglas` con `termino`, `nivel` y, opcionalmente, `motivo` (se muestra en el mensaje, p. ej. `Uso frecuente: DOLEX`). Se aplica en la siguiente ejecución.
- **Medicamento o dispositivo del HDV:** fila en `Listado_Terapeutico`. **Vigilancia:** fila en `Vigilancia`.

## Funciones

| Función | Uso | ¿Envía WhatsApp? |
|---|---|---|
| `inicializarHoja()` | Crea pestañas y encabezados | No |
| `cargaInicial(paginas = 5)` | Pobla `Historico` sin enviar | No |
| `probarSinEnviar()` | Flujo completo simulado | No |
| `instalarDisparadores()` | Recrea los disparadores | No |
| `revisarAlertas()` | Función principal | **Sí** |
| `enviarPruebaAlerta()` | Envía a `GA_CHAT_ID` un mensaje marcado como prueba (con la foto del producto si es MED), con una alerta ALTA real; no escribe en la hoja | **Sí** (1 mensaje) |
| `resumenSemanal()` | Resumen semanal | **Sí** |
| `vistaPrevia()` | Muestra en el registro el mensaje de cada alerta de la página 0, esté o no en el `Historico` | No |
| `diagnosticarImagenesPdf()` | Recorre las alertas de `Historico` por lotes (≈4,5 min por ejecución; la siguiente continúa donde quedó), descarga cada PDF, extrae las imágenes JPEG y pone la foto candidata en la pestaña `Diag_Imagenes`. Al terminar registra cuántas alertas tienen foto por fuente y tipo | No |
| `reiniciarDiagnosticoImagenes()` | Vacía `Diag_Imagenes` para repetir el diagnóstico desde cero | No |
| `probarAcceso()`, `volcarMuestraHtml()` | Diagnóstico del sitio INVIMA | No |

## Pruebas locales

```bash
npm test
```

## Alcance

Exclusivo HDV E.S.E. (Villavicencio). Los PDF de medicamentos se descargan solo para extraer la foto del producto (autorizado por el referente el 20/10/2026); su texto no se analiza. Marco: Resolución 4816 de 2008 (tecnovigilancia), programa de farmacovigilancia, alertas sanitarias INVIMA.
