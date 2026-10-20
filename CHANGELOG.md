# Changelog

Todas las fechas en hora de Colombia (America/Bogota).

## [1.6.0] - 2026-10-20

### Quitado
- Encuesta (`sendPoll`) después de las alertas 🔴, a pedido del referente. Las dudas se canalizan con el enlace `wa.me` al chat del QF al final de cada alerta. El máximo de 10 mensajes por ejecución ya no cuenta encuestas.
- `enviarPruebaEncuesta()` pasa a ser `enviarPruebaAlerta()` (un solo mensaje).

## [1.5.0] - 2026-10-20

### Agregado
- Alertas de medicamentos con la **foto del producto** extraída del PDF y el texto completo al pie (`sendFileByUpload`, multipart, al servidor de medios de GREEN-API). Respaldo en texto si no hay foto, el PDF no descarga, el texto supera 1.024 caracteres o la foto falla (salvo 466, que no reintenta). DM sigue como texto.
- Propiedad opcional `GA_MEDIA_URL`; constantes `FOTO_EN_ALERTAS`, `FUENTES_CON_FOTO`, `MAX_CARACTERES_PIE`.
- `enviarPruebaEncuesta()` envía la foto si la alerta es MED.

### Cambiado
- Línea `❓ Dudas: QF Juan Pablo Saavedra HDV · https://wa.me/573245844408` al final de cada alerta y del mensaje agrupado: abre el chat del QF (las opciones de encuesta no admiten enlaces).
- La encuesta de las alertas 🔴 pasa a ser acuse de socialización: "¿recibió y socializó esta información en su servicio?" (Recibida y socializada / Requiero más información con el contacto del QF Juan Pablo Saavedra, 3245844408).

## [1.4.2] - 2026-10-20

### Cambiado (diagnóstico de fotos)
- `diagnosticarImagenesPdf()` recorre todas las alertas de `Historico` (80) por lotes de ≈4,5 min; cada ejecución continúa donde quedó la anterior y al final registra `RESUMEN FUENTE:TIPO: n de N con foto`.
- Columna `otras_imagenes` con las imágenes no JPEG; una foto por fila, escalada a la celda.
- `reiniciarDiagnosticoImagenes()` para empezar de cero.

### Resultado con las 80 alertas de `Historico`
- MED (alertas sanitarias): 38 de 40 con foto del producto en JPEG; con la proporción máxima en 5 (antes 3) se recupera la foto apaisada de 319-2026 (885x282) → 39 de 40. La restante (252-2026) solo trae el banner.
- DM (alertas e informes): ninguna foto. Todos los PDF traen las mismas 4 imágenes de plantilla (3000x326, encabezado y pie); el peso extra de las alertas DM (≈1,1 MB) no son fotos.
- Las imágenes FlateDecode DeviceGray del mismo tamaño que un JPEG son máscaras de transparencia, no fotos.

## [1.4.1] - 2026-10-20

### Cambiado (diagnóstico de fotos)
- Primera corrida: en la alerta MED 329-2026 (BUSCAPINA falsificada) la imagen elegida fue la foto del producto falsificado; los informes de seguridad de DM solo traen los logos de la plantilla (sin JPEG).
- `diagnosticarImagenesPdf()` toma solo alertas sanitarias (hasta 3 por fuente, cualquier nivel) y muestra las dos fotos candidatas más grandes (columnas H e I).
- Se descartan las franjas de encabezado o pie de página (un lado más de 3 veces el otro).
- Segunda corrida: MED 330, 329 y 322 con foto del producto (3 de 3). DM 355, 353 y 352 sin JPEG: el diagnóstico describe ahora las imágenes no JPEG (tamaño, filtro, color) para decidir si se extraen. Fotos escaladas a la celda.

## [1.4.0] - 2026-10-20

### Agregado (diagnóstico)
- `diagnosticarImagenesPdf()`: descarga el PDF de hasta 4 alertas ALTA/MEDIA, extrae los JPEG incrustados (`/DCTDecode`) y coloca el más grande (≥ 15 KB) en la pestaña `Diag_Imagenes`. Sin envíos.
- `enviarPruebaEncuesta()`: mensaje de prueba y encuesta al grupo de pruebas.

### Agregado
- Encuesta de WhatsApp (`sendPoll`) después de cada alerta 🔴 ALTA: "¿aplica al HDV?" con opciones Sí aplica / No aplica / En revisión. Cuenta dentro del máximo de 10 mensajes por ejecución; `probarSinEnviar()` la muestra en el registro.

### Cambiado
- Toda llamada a GREEN-API pasa por `llamarGreenApi_()`: solo `GA_CHAT_ID` de grupo, manejo del 466 sin reintento y token oculto en registros.

## [1.3.0] - 2026-10-20

### Cambiado
- Mensajes con formato de WhatsApp y emojis: prioridad en negrita, 💊/🩺 según fuente, título sin "Alerta sanitaria sobre:", coincidencias en viñetas y firma del bot. Mismo estilo en el resumen semanal, el mensaje agrupado y el aviso técnico.
- Si la fecha del listado de INVIMA no corresponde al año de la alerta, se muestra la fecha de detección.

## [1.2.0] - 2026-10-20

### Cambiado
- La pestaña `Catalogo_HDV` pasa a llamarse `Listado_Terapeutico` (Listado Terapéutico de Medicamentos y Dispositivos Médicos del HDV).
- `Reglas` admite la columna `motivo`, que se muestra en la coincidencia (`Uso frecuente: OZEMPIC`).

### Corregido
- `revisarAlertas()` y `probarSinEnviar()` leen la página siguiente cuando toda la página 0 es nueva (hasta 3 páginas). Antes, si INVIMA publicaba más de 8 alertas el mismo día, las sobrantes quedaban en la página 1 y se perdían.

### Agregado
- `vistaPrevia()`: mensaje de cada alerta de la página 0, aunque ya esté registrada; sin envío ni escritura.

### Corregido (revisión con las 80 alertas reales de la carga inicial)
- "placas de Petri" ya no coincide con placas de osteosíntesis; "con balón" ya no coincide con balones de hemodinamia (términos específicos en `Listado_Terapeutico`).
- Prefijos de `LoteSerial` que son palabras comunes (MICRO, MEDICAL, NEXT, ALFA, DELTA, ARGON, PRECISION…) ya no cuentan como laboratorio.
- La coincidencia se agrupa por término, el más específico primero, con un producto de ejemplo: `ENDOTRAQUEAL: TUBO ENDOTRAQUEAL Nº 3.0 SIN NEUMO (…) y 18 más`.
- Sets de bomba de infusión e insertos tibiales con términos que sí aparecen en las alertas.

### Agregado
- 53 marcas comerciales de medicamentos de uso frecuente como reglas ALTA (motivo "Uso frecuente").

## [1.1.0] - 2026-10-20

### Agregado
- Catálogo de productos (hoy `Listado_Terapeutico`) con columnas `subgrupo`, `lote` y `laboratorio`; cargado con 1.212 productos de `DTSUMINISTRO` (lote y laboratorio por fórmula desde `Aux_Productos`).
- Lote dispensado en el título de la alerta -> ALTA; laboratorio proveedor -> al menos MEDIA.
- `Vigilancia` precargada (antimicrobianos PROA y control especial presentes en el catálogo), con columna `motivo`.
- Combinaciones (`+`, `/`, `;`) separadas en términos y tolerancia a plurales en la coincidencia.

## [1.0.0] - 2026-10-20

### Agregado
- `inicializarHoja()`: pestañas `Config_Fuentes`, `Historico`, `Catalogo_HDV` (hoy `Listado_Terapeutico`), `Reglas` (precargada), `Vigilancia` y `Log`.
- `parsearListado_(html, fuente)`: parseo del listado Drupal (título, tipo, fecha, ID y estado DM, PDF).
- Clave única `FUENTE:AS|IS:NUMERO-AÑO` (aprobada por el referente: distingue alertas sanitarias de informes de seguridad, que tienen numeración propia).
- Clasificación ALTA / MEDIA / BAJA por catálogo HDV, Vigilancia y Reglas.
- `revisarAlertas()`, `cargaInicial(paginas = 5)`, `probarSinEnviar()`, `resumenSemanal()`, `instalarDisparadores()`.
- Envío GREEN-API solo a `GA_CHAT_ID` (bloquea chatId que no sea grupo `@g.us`), manejo del 466 sin reintento, máximo 10 mensajes por ejecución, aviso técnico de listado ilegible una vez al día, token ocultado en registros.
- `test/dry-run.js`: 15 pruebas del flujo completo con servicios simulados.

### Verificado con `probarAcceso()` / `volcarMuestraHtml()`
- MED `/alertas/medicamentos-productos-biologicos`: HTTP 200, 8 PDF.
- DM: la ruta `dispositivos-medicos-otras-tecnologias` da 404; la correcta es `/alertas/dispositivos-medicos-invima` (HTTP 200).
- DM incluye informes de seguridad en la carpeta `INFORMES DE SEGURIDAD`.

## [0.1.0] - 2026-10-20

### Agregado
- `probarAcceso()`: prueba de acceso a las fuentes INVIMA.
