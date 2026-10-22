# Changelog

Todas las fechas en hora de Colombia (America/Bogota).

## [2.2.1] - 2026-10-22

### Cambiado
- Encabezado del resumen: "📊 *Resumen semanal de alertas e informes de seguridad INVIMA*". Sin novedades: "✅ *Sin alertas sanitarias ni informes de seguridad nuevos reportados por el INVIMA*" y "Listados monitoreados: medicamentos y productos biológicos; dispositivos médicos y otras tecnologías."

## [2.2.0] - 2026-10-22

### Cambiado
- Firma de todos los mensajes (alertas, resumen semanal, mensaje agrupado y aviso técnico): "_Bot Alertas INVIMA · Ecosistema de Vigilancia Digital del Servicio Farmacéutico HDV_" / "_Desarrollado por el QF Juan Pablo Saavedra_".
- Resumen semanal sin novedades con redacción técnica: "✅ *Sin alertas sanitarias ni informes de seguridad nuevos reportados por el INVIMA*", alcance del monitoreo (medicamentos y productos biológicos; dispositivos médicos y otras tecnologías), y horas de vigilancia activa (se retiró la línea sobre requerimientos de verificación, a pedido del referente).

## [2.1.1] - 2026-10-22

### Cambiado
- Resumen semanal sin novedades: "Sin alertas sanitarias ni informes de seguridad nuevos detectados en la semana." (incluye los informes de seguridad, no solo las alertas).

## [2.1.0] - 2026-10-22

### Cambiado
- Se envían **todas las alertas nuevas**, también las ⚪ BAJA, en la revisión en que se detectan (decisión del referente). Orden: ALTA, MEDIA, BAJA. La encuesta va solo después de ALTA y MEDIA. El resumen del lunes deja de repetir las BAJA ya enviadas. `ENVIAR_BAJA = false` restablece el comportamiento anterior.
- El mensaje agrupado (más de 10) dice "N alertas nuevas".

## [2.0.0] - 2026-10-22

### Cambiado
- **INVIMA cambió de sitio** (Odoo, `www.invima.gov.co/alertas-sanitarias`). El bot lee las tarjetas nuevas (`parsearTarjetas_`): número, título, alerta/informe, estado, fecha (`dd-mm-aaaa` → `aaaa-mm-dd`), clasificación ("Producto fraudulento", "Producto defectuoso"…) y PDF `/alertas-sanitarias/<id>/pdf`. Fuentes: `?direccion=dm` (MED) y `?direccion=dd` (DM); páginas `/page/N`.
- Las URL viejas de `Config_Fuentes` se traducen solas (`migrarUrlFuente_`). Las claves con número no cambian; las alertas sin número ya registradas se reconocen por fuente y título, así que nada se reenvía.
- El mensaje muestra la clasificación junto a la fecha (`📅 Publicada: 2026-10-16 · Producto fraudulento`) y el estado sin ID cuando no lo hay (`🆔 Estado: En seguimiento`).
- La foto del producto se busca también en los PDF `/pdf` del sitio nuevo.
- `vistaPrevia()` con el sitio real: 22 de 24 tarjetas reconocidas; las "Alerta sanitaria especial" Parte 5 y Parte 6 salían como nuevas porque el sitio nuevo no les muestra número (antes 307 y 308-2026, tomados del PDF). Las alertas sin número se reconocen ahora por fuente + título + fecha de publicación contra todo el `Historico`, y su clave incluye la fecha (`MED:AS:T:<título>:2026-10-20`) para no confundir alertas distintas con el mismo título.

## [1.9.5] - 2026-10-22

### Agregado
- `probarAcceso()` confirmó el cambio de sitio de INVIMA: MED, DM y el índice `/alertas` devuelven la misma página (133.247 caracteres, título "Alertas sanitarias e informes de seguridad | Invima", menú nuevo) sin el listado Drupal. `inspeccionarSitioInvima()` registra enlaces, scripts, URLs de API/JSON, marcadores de plataforma y un fragmento alrededor de la primera alerta, para adaptar `parsearListado_`.

## [1.9.4] - 2026-10-22

### Agregado
- 22/10/2026, 2:15 p. m.: MED y DM respondieron HTTP 200 sin ninguna alerta y salió el aviso técnico. Cuando un listado no trae alertas, el `Log` (columna error) guarda ahora la longitud, el `<title>` y el inicio del texto de la página recibida, para distinguir mantenimiento, bloqueo o cambio de marcado. `probarAcceso()` muestra lo mismo.

## [1.9.3] - 2026-10-21

### Documentación
- README: sección "Flujo de funcionamiento" con diagramas (vista general, revisión, clasificación, envío con foto y encuesta, estados en `Historico`), calendario y responsables. Se actualizan la clave sin número, el uso del PDF y los métodos de GREEN-API.

## [1.9.2] - 2026-10-20

### Corregido
- Primera ejecución por disparador (2:21 p. m.): INVIMA publicó "SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO" con el enlace "Ver" roto (`ckfinder.html`, sin número). La clave de respaldo era la URL, igual para todas las alertas con ese enlace: una segunda se habría descartado como repetida. Ahora, si el enlace no es un PDF, la clave es `FUENTE:AS:T:<título normalizado>`; las ya guardadas con la clave anterior se reconocen por clave y título.

## [1.9.1] - 2026-10-20

### Cambiado
- Opciones de la encuesta de socialización: ✅ Sí / ❌ No (a pedido del referente). La pregunta no cambia.

## [1.9.0] - 2026-10-20

### Cambiado
- Se probó reemplazar la encuesta por una reacción ✅ y el referente prefirió la encuesta después del mensaje. Segunda opción (WhatsApp exige al menos 2): "❓ Requiero más información: QF Juan Pablo Saavedra HDV · 3245844408" en lugar de "⏳ Recibida, pendiente por socializar".

## [1.8.0] - 2026-10-20

### Agregado
- Encuesta de socialización después de cada alerta enviada de forma individual (`sendPoll`, una respuesta): "🔴 Alerta sanitaria No. 329-2026 (MED): ¿recibió y socializó esta información en su servicio?" con ✅ Recibida y socializada en mi servicio / ⏳ Recibida, pendiente por socializar (WhatsApp exige al menos 2 opciones). No va con el mensaje agrupado ni si la alerta falló; `ENCUESTA_ACTIVA = false` la apaga. Integrado desde `main` (copia del proyecto vivo) con `test/encuesta.js`.

## [1.7.0] - 2026-10-20

### Agregado
- `buscarIdGrupo()`: obtiene el chatId de un grupo a partir de un mensaje `ID BOT` escrito en él (solo lectura, sin `getContacts`), para cambiar `GA_CHAT_ID` al grupo de producción.

## [1.6.1] - 2026-10-20

### Corregido
- Verificado en PRUEBA BOT (20/10/2026, 2:03 p. m.): alerta MED 329-2026 enviada como foto del producto con el texto al pie y el enlace `wa.me`, con `GA_MEDIA_URL` = `https://7107.api.greenapi.com` (el valor *mediaUrl* de esta instancia es el mismo servidor de la API).
- Primera prueba real en PRUEBA BOT: `7107.media.greenapi.com` no existe (error de DNS) y la alerta salió como texto. Si el servidor de medios no responde, la foto se reintenta en el servidor de la API; `GA_MEDIA_URL` (valor *mediaUrl* de la consola) tiene prioridad.

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
