# Changelog

Todas las fechas en hora de Colombia (America/Bogota).

## [1.2.0] - 2026-10-20

### Cambiado
- La pestaña `Catalogo_HDV` pasa a llamarse `Listado_Terapeutico` (Listado Terapéutico de Medicamentos y Dispositivos Médicos del HDV).
- `Reglas` admite la columna `motivo`, que se muestra en la coincidencia (`Uso frecuente: OZEMPIC`).

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
