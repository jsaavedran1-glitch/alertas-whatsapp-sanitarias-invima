// =====================================================================
// Bot "alertas-sanitarias-invima-hdv"
// Servicio Farmaceutico - Hospital Departamental de Villavicencio E.S.E.
// Vigila las alertas sanitarias de INVIMA (medicamentos y dispositivos
// medicos) y publica las relevantes en el grupo de WhatsApp via GREEN-API.
//
// Funciones publicas (orden de puesta en marcha):
//   inicializarHoja() -> cargaInicial() -> probarSinEnviar() -> instalarDisparadores()
// Operacion: revisarAlertas() y resumenSemanal() (por disparador).
// Diagnostico (sin WhatsApp): probarAcceso(), volcarMuestraHtml(), vistaPrevia(), diagnosticarImagenesPdf().
// =====================================================================

var TZ = "America/Bogota";
var USER_AGENT = "HDV-ESE-ServicioFarmaceutico-AlertasINVIMA/1.0 (Apps Script; Villavicencio, Colombia)";
var BASE_INVIMA = "https://app.invima.gov.co";

var MAX_PAGINAS_REVISION = 3;   // el listado trae 8 items por pagina; se sigue a la siguiente solo si toda la pagina es nueva
var MAX_MENSAJES = 10;           // por ejecucion; si hay mas, un solo mensaje agrupado

// Foto del producto (extraida del PDF) con el texto de la alerta al pie. Solo MED: en el
// diagnostico de 80 alertas, 39 de 40 de medicamentos traen foto; las de DM solo la plantilla.
var FOTO_EN_ALERTAS = true;
var FUENTES_CON_FOTO = ["MED"];
var MAX_CARACTERES_PIE = 1024;    // si el texto es mas largo, la alerta sale solo como texto
var ESPERA_MENSAJES_MS = 2000;   // entre mensajes de WhatsApp
var ESPERA_FUENTES_MS = 1500;    // entre descargas a INVIMA
var MAX_BAJA_RESUMEN = 40;       // titulos BAJA listados en el resumen semanal
var LONGITUD_MIN_TERMINO = 4;    // Listado Terapeutico y Vigilancia: evita coincidencias espurias con nombres cortos
var LONGITUD_MIN_LOTE = 5;       // lotes de al menos 5 caracteres y con algun digito
var PROPORCION_MAX_FOTO = 5;     // mas alargadas son franjas de encabezado (1649x195 = 8,5); fotos hasta 885x282 = 3,1
var MAX_MS_DIAGNOSTICO = 270000; // diagnosticarImagenesPdf se detiene a los 4,5 min (limite de 6)

// Prefijos de LoteSerial que no identifican a un laboratorio o fabricante concreto.
var LABORATORIOS_GENERICOS = ["GLOBAL", "LIFE", "AMERICAN", "GOLDEN", "MEDICAL", "PHARMA", "FARMA", "PLUS", "MICRO",
  "LABORATORIOS", "HUMAN", "NEXT", "ALFA", "DELTA", "ARGON", "PRECISION", "WELL", "MAX", "SEVEN", "EVER", "WINNER"];
var HORAS_REVISION = [6, 10, 14, 18];

var COL_ENVIADO = 12; // columna "enviado" en Historico

// Fuentes por defecto. En operacion se leen de la pestana Config_Fuentes.
var FUENTES_DEFECTO = [
  { fuente: "MED", url: BASE_INVIMA + "/alertas/medicamentos-productos-biologicos" },
  // Verificado en probarAcceso() 2026-10-20: la ruta "dispositivos-medicos-otras-tecnologias" da 404.
  { fuente: "DM", url: BASE_INVIMA + "/alertas/dispositivos-medicos-invima" }
];

// Pagina indice, usada solo en la prueba de acceso para descubrir rutas.
var URL_INDICE_ALERTAS = BASE_INVIMA + "/alertas";

var REGEX_PDF_ALERTA = /ckfinder\/userfiles\/files\/ALERTAS[^"']+\.pdf/gi;

// El listado DM tambien publica informes de seguridad en otra carpeta
// (INFORMES DE SEGURIDAD/...), con numeracion propia (verificado 2026-10-20).
var REGEX_PDF_LISTADO = /ckfinder\/userfiles\/files\/(?:ALERTAS|INFORMES)[^"']+\.pdf/gi;

var ENCABEZADOS = {
  Config_Fuentes: ["fuente", "url", "activa"],
  Historico: ["clave", "fuente", "numero", "anio", "titulo", "tipo", "fecha_publicada", "url_pdf",
    "fecha_deteccion", "nivel", "coincidencia", "enviado"],
  Listado_Terapeutico: ["codigo", "descripcion", "principio_activo", "marca", "tipo", "subgrupo", "lote", "laboratorio"],
  Reglas: ["termino", "nivel", "motivo"],
  Vigilancia: ["principio_activo", "motivo"],
  Log: ["fecha", "fuente", "leidos", "nuevos", "enviados", "estado", "error"]
};

var PRECARGA = {
  Config_Fuentes: FUENTES_DEFECTO.map(function(f) { return [f.fuente, f.url, "SI"]; }),
  Reglas: [
    ["FALSIFICACIÓN", "MEDIA", ""], ["FALSIFICADO", "MEDIA", ""], ["FRAUDULENTO", "MEDIA", ""], ["LOTE", "MEDIA", ""],
    ["RETIRO", "MEDIA", ""], ["RECALL", "MEDIA", ""], ["CALIDAD", "MEDIA", ""], ["CONTAMINACIÓN", "MEDIA", ""],
    ["INFORME DE SEGURIDAD", "MEDIA", ""], ["DESABASTECIMIENTO", "MEDIA", ""],
    ["COMERCIO ELECTRÓNICO", "BAJA", ""], ["SUPLEMENTO", "BAJA", ""], ["HOMEOPÁTICO", "BAJA", ""], ["CBD", "BAJA", ""],
    // Medicamentos comerciales de uso frecuente: ALTA aunque no esten en Listado_Terapeutico.
    ["DOLEX", "ALTA", "Uso frecuente"], ["ADVIL", "ALTA", "Uso frecuente"], ["ASPIRINA", "ALTA", "Uso frecuente"], ["NOXPIRIN", "ALTA", "Uso frecuente"],
    ["SEVEDOL", "ALTA", "Uso frecuente"], ["APRONAX", "ALTA", "Uso frecuente"], ["VOLTAREN", "ALTA", "Uso frecuente"], ["DOLOFEN", "ALTA", "Uso frecuente"],
    ["WINADEINE", "ALTA", "Uso frecuente"], ["ZALDIAR", "ALTA", "Uso frecuente"], ["TRAMAL", "ALTA", "Uso frecuente"], ["BUSCAPINA", "ALTA", "Uso frecuente"],
    ["ALKA-SELTZER", "ALTA", "Uso frecuente"], ["MAREOL", "ALTA", "Uso frecuente"], ["BISOLVON", "ALTA", "Uso frecuente"], ["ENTEROGERMINA", "ALTA", "Uso frecuente"],
    ["PEDIALYTE", "ALTA", "Uso frecuente"], ["ELECTROLIT", "ALTA", "Uso frecuente"], ["NEXIUM", "ALTA", "Uso frecuente"], ["ENSURE", "ALTA", "Uso frecuente"],
    ["GLUCERNA", "ALTA", "Uso frecuente"], ["AUGMENTIN", "ALTA", "Uso frecuente"], ["ROCEPHIN", "ALTA", "Uso frecuente"], ["KLARICID", "ALTA", "Uso frecuente"],
    ["ZITROMAX", "ALTA", "Uso frecuente"], ["XARELTO", "ALTA", "Uso frecuente"], ["ELIQUIS", "ALTA", "Uso frecuente"], ["PLAVIX", "ALTA", "Uso frecuente"],
    ["CRESTOR", "ALTA", "Uso frecuente"], ["GLUCOPHAGE", "ALTA", "Uso frecuente"], ["EUTIROX", "ALTA", "Uso frecuente"], ["LANTUS", "ALTA", "Uso frecuente"],
    ["TOUJEO", "ALTA", "Uso frecuente"], ["NOVORAPID", "ALTA", "Uso frecuente"], ["HUMALOG", "ALTA", "Uso frecuente"], ["OZEMPIC", "ALTA", "Uso frecuente"],
    ["SAXENDA", "ALTA", "Uso frecuente"], ["WEGOVY", "ALTA", "Uso frecuente"], ["MOUNJARO", "ALTA", "Uso frecuente"], ["VICTOZA", "ALTA", "Uso frecuente"],
    ["RIVOTRIL", "ALTA", "Uso frecuente"], ["LYRICA", "ALTA", "Uso frecuente"], ["KEPPRA", "ALTA", "Uso frecuente"], ["VIAGRA", "ALTA", "Uso frecuente"],
    ["CIALIS", "ALTA", "Uso frecuente"], ["HUMIRA", "ALTA", "Uso frecuente"], ["KEYTRUDA", "ALTA", "Uso frecuente"], ["HERCEPTIN", "ALTA", "Uso frecuente"],
    ["AVASTIN", "ALTA", "Uso frecuente"], ["MABTHERA", "ALTA", "Uso frecuente"], ["PERJETA", "ALTA", "Uso frecuente"], ["KADCYLA", "ALTA", "Uso frecuente"],
    ["PROLIA", "ALTA", "Uso frecuente"]
  ]
};

// Estados de la columna "enviado" del Historico.
var ENVIADO = {
  SI: "SI",
  PENDIENTE: "PENDIENTE",
  ERROR: "ERROR",
  CUOTA: "NO_ENVIADO_466",
  SEMANAL: "RESUMEN_SEMANAL",
  CARGA: "CARGA_INICIAL"
};

// =====================================================================
// Funciones publicas
// =====================================================================

// Crea las pestanas con sus encabezados. No sobrescribe pestanas que ya tengan datos.
function inicializarHoja() {
  var ss = abrirHoja_();
  Object.keys(ENCABEZADOS).forEach(function(nombre) {
    var hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (hoja.getLastRow() > 0) {
      Logger.log("Pestana %s ya tiene datos; no se modifica.", nombre);
      return;
    }
    var enc = ENCABEZADOS[nombre];
    hoja.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight("bold");
    hoja.setFrozenRows(1);
    var precarga = PRECARGA[nombre];
    if (precarga) hoja.getRange(2, 1, precarga.length, precarga[0].length).setValues(precarga);
    Logger.log("Pestana %s creada.", nombre);
  });
}

// Pobla el Historico con las alertas ya publicadas, SIN enviar mensajes.
function cargaInicial(paginas) {
  var n = (typeof paginas === "number" && paginas > 0) ? paginas : 5;
  return ejecutar_({ nombre: "CARGA", enviar: false, persistir: true, paginas: n });
}

// Funcion principal (disparador cada 4 horas entre 6:00 y 20:00).
function revisarAlertas() {
  return ejecutar_({ nombre: "REVISION", enviar: true, persistir: true, paginas: MAX_PAGINAS_REVISION });
}

// Todo el flujo, con los mensajes escritos en el registro en vez de enviarse.
// No escribe en el Historico, para no consumir claves.
function probarSinEnviar() {
  var r = ejecutar_({ nombre: "PRUEBA", enviar: false, persistir: false, paginas: MAX_PAGINAS_REVISION });
  resumenSemanal_(false);
  return r;
}

// Muestra en el registro el mensaje que generaria cada alerta de la pagina 0 de cada fuente,
// este o no en el Historico. No envia mensajes ni escribe en la hoja.
function vistaPrevia() {
  var ss = abrirHoja_();
  var reglas = cargarReglas_(ss);
  var claves = clavesHistorico_(ss);
  leerFuentes_(ss).forEach(function(f, i) {
    if (i > 0) Utilities.sleep(ESPERA_FUENTES_MS);
    var r = descargar_(urlPagina_(f.url, 0));
    var items = (r.codigo === 200) ? parsearListado_(r.html, f.fuente) : [];
    Logger.log("[%s] HTTP %s, %s items en la pagina 0", f.fuente, r.codigo, items.length);
    items.forEach(function(it) {
      clasificar_(it, reglas);
      var estado = claves[it.clave] ? "ya registrada en Historico" : "NUEVA";
      Logger.log("[VISTA PREVIA - %s - %s]\n%s", it.clave, estado, formatearMensaje_(it));
    });
  });
}

// ENVIA DE VERDAD a GA_CHAT_ID un mensaje de prueba (con la foto del producto si es MED) con la
// primera alerta ALTA de la pagina 0 (o la primera alerta si no hay ALTA).
// No escribe en el Historico. Usar solo con PRUEBA BOT.
function enviarPruebaAlerta() {
  var ss = abrirHoja_();
  var reglas = cargarReglas_(ss);
  var candidata = null;
  leerFuentes_(ss).some(function(f, i) {
    if (i > 0) Utilities.sleep(ESPERA_FUENTES_MS);
    var r = descargar_(urlPagina_(f.url, 0));
    var items = (r.codigo === 200) ? parsearListado_(r.html, f.fuente) : [];
    items.forEach(function(it) { clasificar_(it, reglas); });
    var alta = items.filter(function(it) { return it.nivel === "ALTA"; })[0];
    candidata = alta || candidata || items[0] || null;
    return !!alta;
  });
  if (!candidata) {
    Logger.log("No se pudo leer ninguna alerta de INVIMA; no se envia nada.");
    return;
  }
  candidata.nivel = "ALTA";
  Logger.log("Enviando prueba a GA_CHAT_ID = %s con la alerta %s", PropertiesService.getScriptProperties().getProperty("GA_CHAT_ID"), candidata.clave);
  var mensaje = emoji_(0x1F9EA) + " *MENSAJE DE PRUEBA* (no es una alerta nueva)\n\n" + formatearMensaje_(candidata);
  var r = enviarAlerta_(mensaje, candidata, true);
  Logger.log("Mensaje: %s", r.ok ? "enviado" + (r.foto ? " con foto" : " como texto") : "NO enviado (" + (r.error || "") + ")");
}

// Resumen semanal (disparador lunes 7:00).
function resumenSemanal() {
  return resumenSemanal_(true);
}

// Elimina los disparadores del proyecto y crea los del bot.
function instalarDisparadores() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  HORAS_REVISION.forEach(function(h) {
    ScriptApp.newTrigger("revisarAlertas").timeBased().atHour(h).nearMinute(15).everyDays(1).inTimezone(TZ).create();
  });
  ScriptApp.newTrigger("resumenSemanal").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7).nearMinute(15).inTimezone(TZ).create();
  Logger.log("Disparadores: revisarAlertas a las %s h; resumenSemanal lunes 7 h (%s).", HORAS_REVISION.join(", "), TZ);
}

// =====================================================================
// Flujo principal
// =====================================================================

function ejecutar_(modo) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("Otra ejecucion esta en curso; se omite esta.");
    return null;
  }
  try {
    var ss = abrirHoja_();
    var fuentes = leerFuentes_(ss);
    var reglas = cargarReglas_(ss);
    var claves = clavesHistorico_(ss);
    var nuevos = [];
    var registros = {};
    var fallidas = [];

    fuentes.forEach(function(f, i) {
      var reg = { fuente: f.fuente, leidos: 0, nuevos: 0, enviados: 0, estado: "OK", error: "" };
      registros[f.fuente] = reg;
      for (var p = 0; p < modo.paginas; p++) {
        if (i > 0 || p > 0) Utilities.sleep(ESPERA_FUENTES_MS);
        var r = descargar_(urlPagina_(f.url, p));
        var items = (r.codigo === 200) ? parsearListado_(r.html, f.fuente) : [];
        if (items.length === 0) {
          if (p === 0) {
            reg.estado = "ERROR";
            reg.error = "No se pudo leer el listado: HTTP " + r.codigo + ", 0 items" + (r.error ? " (" + r.error + ")" : "");
            fallidas.push(f.fuente + " (HTTP " + r.codigo + ")");
            Logger.log("[%s] %s", f.fuente, reg.error);
          }
          break; // en carga inicial, una pagina vacia marca el final
        }
        reg.leidos += items.length;
        var nuevosPagina = 0;
        items.forEach(function(it) {
          if (claves[it.clave]) return;
          claves[it.clave] = true;
          clasificar_(it, reglas);
          it.fechaDeteccion = new Date();
          nuevos.push(it);
          reg.nuevos++;
          nuevosPagina++;
        });
        // En revision, si la pagina ya tiene alertas conocidas no hay nada nuevo mas atras.
        if (modo.nombre !== "CARGA" && nuevosPagina < items.length) break;
      }
    });

    var hist = ss.getSheetByName("Historico");
    if (modo.nombre === "CARGA") {
      persistirItems_(hist, nuevos, ENVIADO.CARGA);
    } else {
      var cuotaAgotada = procesarNuevos_(hist, nuevos, registros, modo);
      if (fallidas.length > 0 && !cuotaAgotada) avisoTecnico_(fallidas, modo.enviar);
    }

    escribirLog_(ss, fuentes.map(function(f) { return registros[f.fuente]; }), modo);
    Logger.log("%s: %s nuevos de %s fuentes.", modo.nombre, nuevos.length, fuentes.length);
    return { nuevos: nuevos, registros: registros };
  } finally {
    lock.releaseLock();
  }
}

// Envia (o simula) las alertas ALTA y MEDIA; las BAJA quedan para el resumen semanal.
// Devuelve true si GREEN-API respondio 466 (cuota excedida).
function procesarNuevos_(hist, nuevos, registros, modo) {
  var inmediatos = nuevos.filter(function(it) { return it.nivel !== "BAJA"; });
  var bajas = nuevos.filter(function(it) { return it.nivel === "BAJA"; });
  inmediatos.sort(function(a, b) { return ordenNivel_(a.nivel) - ordenNivel_(b.nivel); });

  // Idempotencia: la clave queda en el Historico como PENDIENTE ANTES de enviar.
  if (modo.persistir) {
    persistirItems_(hist, bajas, ENVIADO.SEMANAL);
    persistirItems_(hist, inmediatos, ENVIADO.PENDIENTE);
    SpreadsheetApp.flush();
  }

  // Envio individual solo si el total de mensajes cabe en MAX_MENSAJES.
  var lotes = (inmediatos.length <= MAX_MENSAJES)
    ? inmediatos.map(function(it) { return { mensaje: formatearMensaje_(it), items: [it], foto: true }; })
    : [{ mensaje: formatearAgrupado_(inmediatos), items: inmediatos, foto: false }];

  var cuotaAgotada = false;
  lotes.forEach(function(lote, i) {
    var estado;
    if (cuotaAgotada) {
      estado = ENVIADO.CUOTA;
    } else {
      if (i > 0) Utilities.sleep(ESPERA_MENSAJES_MS);
      var r = lote.foto ? enviarAlerta_(lote.mensaje, lote.items[0], modo.enviar) : enviarWhatsApp_(lote.mensaje, modo.enviar);
      if (r.cuota) cuotaAgotada = true;
      estado = r.ok ? ENVIADO.SI : (r.cuota ? ENVIADO.CUOTA : ENVIADO.ERROR);
      if (!r.ok) {
        lote.items.forEach(function(it) {
          var reg = registros[it.fuente];
          reg.estado = r.cuota ? "CUOTA_466" : "ERROR_ENVIO";
          reg.error = r.error || "";
        });
      }
    }
    lote.items.forEach(function(it) {
      it.enviado = estado;
      if (estado === ENVIADO.SI) registros[it.fuente].enviados++;
      if (modo.persistir) hist.getRange(it.fila, COL_ENVIADO).setValue(estado);
    });
  });
  return cuotaAgotada;
}

// Aviso tecnico al grupo: como maximo uno por dia.
function avisoTecnico_(fallidas, enviarReal) {
  var props = PropertiesService.getScriptProperties();
  var hoy = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
  if (props.getProperty("ULTIMO_AVISO_TECNICO") === hoy) {
    Logger.log("Aviso tecnico ya enviado hoy; se omite.");
    return;
  }
  var mensaje = "[INVIMA] " + emoji_(0x26A0) + String.fromCodePoint(0xFE0F) + " No se pudo leer el listado" +
    "\nFuente: " + fallidas.join(", ") + "\n_Se revisará de nuevo en la próxima ejecución._";
  var r = enviarWhatsApp_(mensaje, enviarReal);
  if (enviarReal && r.ok) props.setProperty("ULTIMO_AVISO_TECNICO", hoy);
}

function resumenSemanal_(enviarReal) {
  var ss = abrirHoja_();
  var hist = ss.getSheetByName("Historico");
  var filas = leerFilas_(hist);
  var hasta = new Date();
  var desde = new Date(hasta.getTime() - 7 * 24 * 3600 * 1000);
  var conteo = {};
  var bajas = [];
  filas.forEach(function(f) {
    var fd = f.fecha_deteccion instanceof Date ? f.fecha_deteccion : new Date(f.fecha_deteccion);
    if (isNaN(fd.getTime()) || fd < desde || f.enviado === ENVIADO.CARGA) return;
    var c = conteo[f.fuente] = conteo[f.fuente] || { ALTA: 0, MEDIA: 0, BAJA: 0 };
    if (c[f.nivel] !== undefined) c[f.nivel]++;
    if (f.nivel === "BAJA") bajas.push(f);
  });

  var lineas = ["[INVIMA] " + emoji_(E.RESUMEN) + " *Resumen semanal*",
    "_" + Utilities.formatDate(desde, TZ, "dd/MM/yyyy") + " - " + Utilities.formatDate(hasta, TZ, "dd/MM/yyyy") + "_", ""];
  var fuentesResumen = Object.keys(conteo).sort();
  if (fuentesResumen.length === 0) lineas.push("Sin alertas nuevas detectadas en la semana.");
  fuentesResumen.forEach(function(fu) {
    var c = conteo[fu];
    lineas.push(etiquetaFuente_(fu) + ": " + emojiNivel_("ALTA") + " " + c.ALTA + " · " + emojiNivel_("MEDIA") + " " + c.MEDIA +
      " · " + emojiNivel_("BAJA") + " " + c.BAJA);
  });
  if (bajas.length > 0) {
    lineas.push("", emojiNivel_("BAJA") + " *Baja prioridad (" + bajas.length + "):*");
    bajas.slice(0, MAX_BAJA_RESUMEN).forEach(function(f) {
      lineas.push("• [" + f.fuente + "] " + tituloCorto_(f.titulo), "  " + emoji_(E.ENLACE) + " " + f.url_pdf);
    });
    if (bajas.length > MAX_BAJA_RESUMEN) lineas.push("_... y " + (bajas.length - MAX_BAJA_RESUMEN) + " más en la hoja Historico._");
  }
  lineas.push("", firma_());
  var mensaje = lineas.join("\n");
  var r = enviarWhatsApp_(mensaje, enviarReal);
  escribirLog_(ss, [{ fuente: "RESUMEN", leidos: filas.length, nuevos: bajas.length,
    enviados: (enviarReal && r.ok) ? 1 : 0, estado: r.ok ? "OK" : (r.cuota ? "CUOTA_466" : "ERROR_ENVIO"),
    error: r.error || "" }], { nombre: enviarReal ? "REVISION" : "PRUEBA" });
  return mensaje;
}

// =====================================================================
// Descarga y parseo
// =====================================================================

function descargar_(url) {
  try {
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": USER_AGENT }
    });
    return { codigo: resp.getResponseCode(), html: resp.getContentText("UTF-8") };
  } catch (err) {
    return { codigo: 0, html: "", error: String(err) };
  }
}

function urlPagina_(base, pagina) {
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + "page=" + pagina;
}

// Unico punto de parseo del listado (Drupal Views, HTML del servidor).
// Cada item es un <div class="views-row ... alertas-invima-list"> con:
//   views-field-title, views-field-field-tipo-de-documento, views-field-field-a-o (fecha, NO confiable),
//   views-field-field-numero-de-id-d-m y views-field-field-estado (solo DM),
//   views-field-field-comunicado-invima (enlace "Ver" al PDF).
function parsearListado_(html, fuente) {
  var items = [];
  var bloques = String(html || "").split(/<div class="views-row[ "]/);
  for (var i = 1; i < bloques.length; i++) {
    var b = bloques[i];
    var href = (b.match(/views-field-field-comunicado-invima[\s\S]*?href="([^"]+)"/) || [])[1] ||
      (b.match(/href="([^"]*ckfinder\/userfiles\/files\/[^"]+\.pdf)"/i) || [])[1];
    var titulo = campo_(b, "title");
    if (!href || !titulo) continue;

    var url = limpiarTexto_(href);
    if (url.indexOf("http") !== 0) url = BASE_INVIMA + (url.charAt(0) === "/" ? "" : "/") + url;
    var tipo = campo_(b, "field-tipo-de-documento");
    var esInforme = /INFORME/.test(normalizar_(tipo)) || /\/INFORMES/i.test(url);
    var num = extraerNumero_(decodificarUrl_(url)) || extraerNumero_(titulo);
    var tipoCodigo = esInforme ? "IS" : "AS";

    items.push({
      clave: num ? fuente + ":" + tipoCodigo + ":" + num.numero + "-" + num.anio : fuente + ":" + url,
      fuente: fuente,
      tipoCodigo: tipoCodigo,
      numero: num ? num.numero : "",
      anio: num ? num.anio : "",
      titulo: titulo,
      tipo: tipo || (esInforme ? "Informe de seguridad" : "Alerta sanitaria"),
      fecha: campo_(b, "field-a-o"),
      idDm: campo_(b, "field-numero-de-id-d-m"),
      estadoDm: campo_(b, "field-estado"),
      url: url
    });
  }
  return items;
}

function campo_(bloque, clase) {
  var re = new RegExp('views-field-' + clase + '"[^>]*>\\s*<(?:div|span) class="field-content[^"]*">([\\s\\S]*?)</(?:div|span)>');
  var m = bloque.match(re);
  return m ? limpiarTexto_(m[1]) : "";
}

function extraerNumero_(texto) {
  var m = String(texto || "").match(/No[_.]?\s*#?\s*(\d+)\s*-\s*(\d{4})/i);
  return m ? { numero: m[1], anio: m[2] } : null;
}

function decodificarUrl_(url) {
  try { return decodeURIComponent(url); } catch (e) { return url; }
}

function limpiarTexto_(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, function(m, n) { return String.fromCharCode(Number(n)); })
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// =====================================================================
// Clasificacion
// =====================================================================

// Mayusculas, sin tildes, solo letras/numeros separados por un espacio.
function normalizar_(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

// Forma singular de cada palabra (CATETERES -> CATETER, JERINGAS -> JERINGA). Se aplica
// por igual al titulo y a los terminos, para que los plurales no impidan la coincidencia.
function singularizar_(textoNorm) {
  return textoNorm.split(" ").map(function(p) {
    if (p.length <= 4) return p;
    if (/[RLNDZJ]ES$/.test(p)) return p.slice(0, -2);
    if (/S$/.test(p)) return p.slice(0, -1);
    return p;
  }).join(" ");
}

function normTermino_(s) {
  return singularizar_(normalizar_(s));
}

// Separa combinaciones ("PIPERACILINA/TAZOBACTAM", "TRIMETOPRIMA+SULFAMETOXAZOL") en terminos.
function terminosDe_(texto) {
  return String(texto || "").split(/[+\/;]/).map(normTermino_).filter(function(t) {
    return t.length >= LONGITUD_MIN_TERMINO;
  });
}

// Coincidencia por tokens completos (admite terminos de varias palabras).
function contieneTermino_(textoNorm, terminoNorm) {
  if (!terminoNorm) return false;
  return (" " + textoNorm + " ").indexOf(" " + terminoNorm + " ") >= 0;
}

function cargarReglas_(ss) {
  var reglas = { ALTA: [], MEDIA: [], BAJA: [], listado: [], vigilancia: [] };
  leerFilas_(ss.getSheetByName("Reglas")).forEach(function(r) {
    var nivel = normalizar_(r.nivel);
    var t = normTermino_(r.termino);
    if (t && reglas[nivel]) {
      reglas[nivel].push({ norm: t, texto: String(r.termino).trim(), motivo: String(r.motivo || "").trim() });
    }
  });
  leerFilas_(ss.getSheetByName("Listado_Terapeutico")).forEach(function(c) {
    var item = {
      terminos: terminosDe_(c.principio_activo).concat(terminosDe_(c.marca)),
      lotes: lotesDe_(c.lote),
      laboratorios: laboratoriosDe_(c.laboratorio),
      tipo: normalizar_(c.tipo),
      etiqueta: String(c.descripcion || c.principio_activo).trim() + (c.codigo ? " (" + c.codigo + ")" : "")
    };
    if (item.terminos.length + item.lotes.length + item.laboratorios.length > 0) reglas.listado.push(item);
  });
  leerFilas_(ss.getSheetByName("Vigilancia")).forEach(function(v) {
    terminosDe_(v.principio_activo).forEach(function(t) {
      reglas.vigilancia.push({ norm: t, texto: String(v.principio_activo).trim() });
    });
  });
  return reglas;
}

// Lotes de la columna "lote" (separados por ";"), sin tildes ni signos, con algun digito.
function lotesDe_(texto) {
  return String(texto || "").split(";").map(normalizar_).filter(function(l) {
    return l.length >= LONGITUD_MIN_LOTE && /\d/.test(l);
  });
}

// Laboratorios de la columna "laboratorio" (separados por ";"), sin prefijos genericos.
function laboratoriosDe_(texto) {
  return String(texto || "").split(";").map(normalizar_).filter(function(l) {
    return l.length >= LONGITUD_MIN_TERMINO && LABORATORIOS_GENERICOS.indexOf(l) < 0;
  });
}

// ALTA: Listado Terapeutico HDV (principio activo, marca o lote dispensado), Vigilancia o regla ALTA.
// BAJA: termino BAJA sin coincidencia ALTA.
// MEDIA: termino MEDIA, tipo "Informe de seguridad" o laboratorio proveedor del HDV. BAJA: el resto.
function clasificar_(it, reglas) {
  var t = normTermino_(it.titulo);
  var tLote = normalizar_(it.titulo); // los lotes se comparan sin singularizar
  var coincidencias = [];
  var laboratorios = [];
  var porTermino = {};
  reglas.listado.forEach(function(c) {
    if (c.tipo && c.tipo !== it.fuente) return;
    var lote = c.lotes.filter(function(l) { return contieneTermino_(tLote, l); })[0];
    if (lote) {
      coincidencias.push("Lote " + lote + " dispensado en HDV: " + c.etiqueta);
    } else {
      var termino = c.terminos.filter(function(x) { return contieneTermino_(t, x); })
        .sort(function(a, b) { return b.length - a.length; })[0];
      if (termino) (porTermino[termino] = porTermino[termino] || []).push(c.etiqueta);
    }
    c.laboratorios.forEach(function(l) {
      if (contieneTermino_(tLote, l) && laboratorios.indexOf(l) < 0) laboratorios.push(l);
    });
  });
  // Un renglon por termino encontrado, el mas especifico primero, con un producto de ejemplo.
  Object.keys(porTermino).sort(function(a, b) { return b.length - a.length; }).forEach(function(x) {
    var productos = porTermino[x];
    coincidencias.push(x + ": " + productos[0] + (productos.length > 1 ? " y " + (productos.length - 1) + " más" : ""));
  });
  reglas.vigilancia.forEach(function(v) {
    if (contieneTermino_(t, v.norm)) coincidencias.push("Vigilancia: " + v.texto);
  });
  reglas.ALTA.forEach(function(r) {
    if (contieneTermino_(t, r.norm)) coincidencias.push((r.motivo || "Regla") + ": " + r.texto);
  });
  var hay = function(lista) { return lista.some(function(r) { return contieneTermino_(t, r.norm); }); };

  if (coincidencias.length > 0) {
    it.nivel = "ALTA";
  } else if (hay(reglas.BAJA)) {
    it.nivel = "BAJA";
  } else if (hay(reglas.MEDIA) || it.tipoCodigo === "IS" || laboratorios.length > 0) {
    it.nivel = "MEDIA";
  } else {
    it.nivel = "BAJA";
  }
  if (laboratorios.length > 0) coincidencias.push("Laboratorio proveedor HDV: " + laboratorios.join(", "));
  it.coincidencia = coincidencias.filter(function(c, i) { return coincidencias.indexOf(c) === i; })
    .slice(0, 3).join("; ");
  return it;
}

function ordenNivel_(nivel) {
  return { ALTA: 0, MEDIA: 1, BAJA: 2 }[nivel];
}

// =====================================================================
// Mensajes
// =====================================================================

function emoji_(codigo) {
  return String.fromCodePoint(codigo);
}

// Emojis de los mensajes (con String.fromCodePoint para no danar la codificacion en el editor).
var E = {
  MED: 0x1F48A,        // pastilla
  DM: 0x1FA7A,         // estetoscopio
  TITULO: 0x1F4CC,     // chincheta
  FECHA: 0x1F4C5,      // calendario
  ID: 0x1F194,         // ID
  HDV: 0x1F3E5,        // hospital
  PDF: 0x1F4C4,        // documento
  ENLACE: 0x1F517,     // enlace
  RESUMEN: 0x1F4CA,    // grafico
  REVISAR: 0x1F50E,    // lupa
  DUDAS: 0x2753        // signo de pregunta
};

// Contacto para dudas: enlace wa.me que abre el chat del QF (no envia nada ni consume cuota).
var CONTACTO_DUDAS = { nombre: "QF Juan Pablo Saavedra HDV", wa: "573245844408" };

function lineaContacto_() {
  return emoji_(E.DUDAS) + " Dudas: " + CONTACTO_DUDAS.nombre + " · https://wa.me/" + CONTACTO_DUDAS.wa;
}

function emojiNivel_(nivel) {
  return emoji_({ ALTA: 0x1F534, MEDIA: 0x1F7E0, BAJA: 0x26AA }[nivel]);
}

function etiquetaFuente_(fuente) {
  if (fuente === "MED") return emoji_(E.MED) + " Medicamento";
  if (fuente === "DM") return emoji_(E.DM) + " Dispositivo médico";
  return fuente;
}

function encabezado_(it) {
  var base = it.tipoCodigo === "IS" ? "Informe de seguridad" : "Alerta sanitaria";
  return base + (it.numero ? " No. " + it.numero + "-" + it.anio : "");
}

// Quita "Alerta sanitaria sobre:" / "Informe de seguridad sobre:", que ya va en el encabezado.
function tituloCorto_(titulo) {
  return String(titulo || "").replace(/^\s*(alerta\s+sanitaria|informe\s+de\s+seguridad)\s+sobre\s*:\s*/i, "").trim() || titulo;
}

// La fecha del listado de INVIMA no es confiable (alertas 2026 con fecha 2016-10-14): si su ano no
// coincide con el de la alerta, se muestra la fecha en que el bot la detecto.
function lineaFecha_(it) {
  var anioFecha = String(it.fecha || "").slice(0, 4);
  if (it.fecha && (!it.anio || anioFecha === String(it.anio))) return emoji_(E.FECHA) + " Publicada: " + it.fecha;
  return emoji_(E.FECHA) + " Detectada: " + Utilities.formatDate(it.fechaDeteccion || new Date(), TZ, "yyyy-MM-dd");
}

function firma_() {
  return "_Bot Alertas INVIMA · Servicio Farmacéutico HDV_";
}

function formatearMensaje_(it) {
  var lineas = [
    "[INVIMA-" + it.fuente + "] " + emojiNivel_(it.nivel) + " *PRIORIDAD " + it.nivel + "* · " + etiquetaFuente_(it.fuente),
    "*" + encabezado_(it) + "*",
    "",
    emoji_(E.TITULO) + " " + tituloCorto_(it.titulo),
    lineaFecha_(it)
  ];
  if (it.idDm || it.estadoDm) {
    lineas.push(emoji_(E.ID) + " ID INVIMA: " + (it.idDm || "—") + " · Estado: " + (it.estadoDm || "—"));
  }
  if (it.coincidencia) {
    lineas.push("", emoji_(E.HDV) + " *Coincidencia HDV:*");
    it.coincidencia.split("; ").forEach(function(c) { lineas.push("• " + c); });
  }
  lineas.push("", emoji_(E.PDF) + " PDF: " + it.url, lineaContacto_(), "", firma_());
  return lineas.join("\n");
}

// Mensaje unico cuando hay mas de MAX_MENSAJES alertas inmediatas en una ejecucion.
function formatearAgrupado_(items) {
  var lineas = ["[INVIMA] " + emoji_(E.REVISAR) + " *" + items.length + " alertas nuevas ALTA/MEDIA*", "_Resumen agrupado_"];
  items.forEach(function(it) {
    lineas.push("", emojiNivel_(it.nivel) + " *" + encabezado_(it) + "* · " + etiquetaFuente_(it.fuente),
      emoji_(E.TITULO) + " " + tituloCorto_(it.titulo));
    if (it.coincidencia) lineas.push(emoji_(E.HDV) + " " + it.coincidencia.split("; ")[0]);
    lineas.push(emoji_(E.ENLACE) + " " + it.url);
  });
  lineas.push("", lineaContacto_(), "", firma_());
  return lineas.join("\n");
}

// =====================================================================
// Envio GREEN-API (solo a GA_CHAT_ID)
// =====================================================================

function enviarWhatsApp_(mensaje, enviarReal) {
  if (!enviarReal) {
    Logger.log("[SIMULADO - no enviado]\n%s", mensaje);
    return { ok: true, simulado: true };
  }
  return llamarGreenApi_("sendMessage", { message: mensaje });
}

// Alerta individual: si es de una fuente con foto, envia la foto del producto (primer JPEG util del
// PDF) con el texto al pie (sendFileByUpload). Si no hay foto, el texto es muy largo o el envio de la
// foto falla por otra causa que no sea el 466, se envia como texto. Cuenta como un solo mensaje.
function enviarAlerta_(mensaje, it, enviarReal) {
  var foto = (mensaje.length <= MAX_CARACTERES_PIE) ? fotoProducto_(it) : null;
  if (!foto) return enviarWhatsApp_(mensaje, enviarReal);
  if (!enviarReal) {
    Logger.log("[SIMULADO - foto %s KB %sx%s, texto al pie]\n%s", foto.kb, foto.ancho, foto.alto, mensaje);
    return { ok: true, simulado: true, foto: true };
  }
  var r = llamarGreenApi_("sendFileByUpload", {
    file: Utilities.newBlob(foto.bytes, "image/jpeg", nombreFoto_(it)),
    fileName: nombreFoto_(it),
    caption: mensaje
  });
  if (r.ok) {
    r.foto = true;
    return r;
  }
  if (r.cuota) return r;
  Logger.log("[%s] Foto no enviada (%s); se envia como texto.", it.clave, r.error || "");
  Utilities.sleep(ESPERA_MENSAJES_MS);
  return enviarWhatsApp_(mensaje, enviarReal);
}

// Descarga el PDF de la alerta solo para extraer la foto del producto; no se analiza su texto.
function fotoProducto_(it) {
  if (!FOTO_EN_ALERTAS || FUENTES_CON_FOTO.indexOf(it.fuente) < 0 || !it.url || !/\.pdf$/i.test(it.url)) return null;
  try {
    var resp = UrlFetchApp.fetch(it.url, { muteHttpExceptions: true, headers: { "User-Agent": USER_AGENT } });
    if (resp.getResponseCode() !== 200) {
      Logger.log("[%s] PDF HTTP %s: se envia sin foto.", it.clave, resp.getResponseCode());
      return null;
    }
    return elegirFoto_(extraerJpegsPdf_(resp.getBlob().getBytes()).jpegs);
  } catch (e) {
    Logger.log("[%s] No se pudo extraer la foto (%s): se envia sin foto.", it.clave, e);
    return null;
  }
}

function nombreFoto_(it) {
  return String(it.clave).replace(/[^A-Za-z0-9-]+/g, "_") + ".jpg";
}

// Unica salida hacia GREEN-API: siempre al GA_CHAT_ID (grupo), maneja el 466 sin reintentar.
function llamarGreenApi_(metodo, datos) {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = props.getProperty("GA_API_URL");
  var id = props.getProperty("GA_ID");
  var token = props.getProperty("GA_TOKEN");
  var chatId = props.getProperty("GA_CHAT_ID");
  if (!apiUrl || !id || !token || !chatId) {
    Logger.log("Faltan propiedades GA_API_URL / GA_ID / GA_TOKEN / GA_CHAT_ID.");
    return { ok: false, error: "Faltan propiedades GA_*" };
  }
  if (!/@g\.us$/.test(chatId)) {
    Logger.log("GA_CHAT_ID no corresponde a un grupo (@g.us); envio bloqueado.");
    return { ok: false, error: "GA_CHAT_ID no es un grupo" };
  }
  var cuerpo = { chatId: chatId };
  Object.keys(datos).forEach(function(k) { cuerpo[k] = datos[k]; });
  // Los archivos van como multipart/form-data al servidor de medios (GA_MEDIA_URL o, si falta, el de la
  // API con "media" en vez de "api"); si ese servidor no responde (DNS, conexion), se intenta en el de
  // la API. Un error de conexion significa que no se entrego nada, asi que no hay riesgo de duplicar.
  // El resto de metodos va como JSON al servidor de la API.
  var archivo = metodo === "sendFileByUpload";
  var bases = archivo
    ? [props.getProperty("GA_MEDIA_URL"), apiUrl.replace(".api.", ".media."), apiUrl]
    : [apiUrl];
  bases = bases.filter(function(b, k) { return b && bases.indexOf(b) === k; });
  var opciones = archivo
    ? { method: "post", payload: cuerpo, muteHttpExceptions: true }
    : { method: "post", contentType: "application/json", payload: JSON.stringify(cuerpo), muteHttpExceptions: true };
  var ultimoError = "";
  for (var k = 0; k < bases.length; k++) {
    var resp;
    try {
      resp = UrlFetchApp.fetch(String(bases[k]).replace(/\/+$/, "") + "/waInstance" + id + "/" + metodo + "/" + token, opciones);
    } catch (err) {
      ultimoError = ocultar_(String(err), token);
      Logger.log("GREEN-API %s excepcion: %s", metodo, ultimoError);
      continue;
    }
    var codigo = resp.getResponseCode();
    if (codigo === 200) return { ok: true, codigo: codigo };
    if (codigo === 466) {
      Logger.log("GREEN-API 466 (%s): cuota mensual excedida. No se reintenta.", metodo);
      return { ok: false, cuota: true, codigo: codigo, error: "HTTP 466 cuota excedida" };
    }
    var texto = ocultar_(resp.getContentText().substring(0, 300), token);
    Logger.log("GREEN-API %s HTTP %s: %s", metodo, codigo, texto);
    return { ok: false, codigo: codigo, error: "HTTP " + codigo };
  }
  return { ok: false, error: ultimoError };
}

// Evita que el token aparezca en registros o en la hoja.
function ocultar_(texto, token) {
  return token ? String(texto).split(token).join("***") : String(texto);
}

// =====================================================================
// Hoja de control
// =====================================================================

function abrirHoja_() {
  var ssId = PropertiesService.getScriptProperties().getProperty("SS_ID");
  if (!ssId) throw new Error("Falta la propiedad SS_ID.");
  return SpreadsheetApp.openById(ssId);
}

// Devuelve las filas como objetos con las claves del encabezado.
function leerFilas_(hoja) {
  if (!hoja) throw new Error("Falta una pestana de control. Ejecute inicializarHoja().");
  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  var enc = datos[0].map(function(h) { return String(h).trim().toLowerCase(); });
  return datos.slice(1).map(function(fila) {
    var o = {};
    enc.forEach(function(h, i) { o[h] = fila[i]; });
    return o;
  });
}

function leerFuentes_(ss) {
  var filas = leerFilas_(ss.getSheetByName("Config_Fuentes")).filter(function(f) {
    return f.fuente && f.url && normalizar_(f.activa) !== "NO";
  });
  if (filas.length === 0) throw new Error("Config_Fuentes no tiene fuentes activas.");
  return filas.map(function(f) {
    return { fuente: String(f.fuente).trim().toUpperCase(), url: String(f.url).trim() };
  });
}

function clavesHistorico_(ss) {
  var hoja = ss.getSheetByName("Historico");
  if (!hoja) throw new Error("Falta la pestana Historico. Ejecute inicializarHoja().");
  var claves = {};
  var ultima = hoja.getLastRow();
  if (ultima < 2) return claves;
  hoja.getRange(2, 1, ultima - 1, 1).getValues().forEach(function(f) {
    if (f[0]) claves[String(f[0])] = true;
  });
  return claves;
}

function persistirItems_(hoja, items, enviado) {
  if (items.length === 0) return;
  var inicio = hoja.getLastRow() + 1;
  var filas = items.map(function(it, i) {
    it.fila = inicio + i;
    it.enviado = enviado;
    return [it.clave, it.fuente, it.numero, it.anio, it.titulo, it.tipo, it.fecha, it.url,
      it.fechaDeteccion, it.nivel, it.coincidencia, enviado];
  });
  hoja.getRange(inicio, 1, filas.length, filas[0].length).setValues(filas);
}

function escribirLog_(ss, registros, modo) {
  var hoja = ss.getSheetByName("Log");
  if (!hoja || registros.length === 0) return;
  var ahora = new Date();
  var filas = registros.map(function(r) {
    var estado = modo.nombre === "REVISION" ? r.estado : modo.nombre + "/" + r.estado;
    return [ahora, r.fuente, r.leidos, r.nuevos, r.enviados, estado, r.error];
  });
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
}

// =====================================================================
// Diagnostico (solo lectura: no envia mensajes ni escribe en la hoja)
// =====================================================================

function probarAcceso() {
  var objetivos = FUENTES_DEFECTO.map(function(f) {
    return { fuente: f.fuente, url: f.url + "?page=0" };
  });
  objetivos.push({ fuente: "INDICE", url: URL_INDICE_ALERTAS });

  objetivos.forEach(function(obj, i) {
    if (i > 0) Utilities.sleep(ESPERA_FUENTES_MS);
    var inicio = Date.now();
    try {
      var resp = UrlFetchApp.fetch(obj.url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { "User-Agent": USER_AGENT }
      });
      var html = resp.getContentText("UTF-8");
      var pdfs = html.match(REGEX_PDF_ALERTA) || [];
      Logger.log("[%s] %s", obj.fuente, obj.url);
      Logger.log("   HTTP=%s | longitud HTML=%s | enlaces PDF ALERTAS=%s | %s ms",
        resp.getResponseCode(), html.length, pdfs.length, Date.now() - inicio);
      if (pdfs.length > 0) Logger.log("   Primer PDF: %s", pdfs[0]);
      registrarEnlacesAlertas_(html);
    } catch (err) {
      Logger.log("[%s] %s -> EXCEPCION: %s", obj.fuente, obj.url, err);
    }
  });
}

// Registra el HTML que rodea los dos primeros enlaces PDF (alertas o informes)
// de cada fuente, para conocer el marcado real de cada item (titulo, tipo, fecha, "Ver").
function volcarMuestraHtml() {
  FUENTES_DEFECTO.forEach(function(f, i) {
    if (i > 0) Utilities.sleep(ESPERA_FUENTES_MS);
    var resp = UrlFetchApp.fetch(f.url + "?page=0", {
      muteHttpExceptions: true,
      headers: { "User-Agent": USER_AGENT }
    });
    var html = resp.getContentText("UTF-8");
    Logger.log("[%s] HTTP=%s", f.fuente, resp.getResponseCode());
    var re = new RegExp(REGEX_PDF_LISTADO.source, "gi");
    var m, n = 0, desde = 0;
    while ((m = re.exec(html)) !== null && n < 2) {
      var ini = Math.max(desde, m.index - 2500);
      var fin = Math.min(html.length, m.index + 400);
      Logger.log("[%s] MUESTRA %s:\n%s", f.fuente, n + 1, html.substring(ini, fin).replace(/\s+/g, " "));
      desde = fin;
      n++;
    }
  });
}

// Recorre las alertas de Historico (todas las fuentes y tipos), descarga su PDF, extrae las
// imagenes JPEG incrustadas y coloca la foto candidata mas grande en la pestana Diag_Imagenes.
// Trabaja por lotes: cada ejecucion continua donde quedo la anterior (claves ya presentes en
// Diag_Imagenes) y se detiene antes del limite de 6 minutos de Apps Script. No envia nada.
function diagnosticarImagenesPdf() {
  var inicio = Date.now();
  var ss = abrirHoja_();
  var hoja = hojaDiagnostico_(ss, false);
  var hechas = {};
  leerFilas_(hoja).forEach(function(f) { if (f.clave) hechas[String(f.clave)] = true; });
  var pendientes = leerFilas_(ss.getSheetByName("Historico")).filter(function(h) {
    return h.clave && h.url_pdf && !hechas[String(h.clave)];
  });
  var procesadas = 0;
  for (var k = 0; k < pendientes.length; k++) {
    if (Date.now() - inicio > MAX_MS_DIAGNOSTICO) break;
    diagnosticarPdf_(hoja, pendientes[k]);
    procesadas++;
  }
  var faltan = pendientes.length - procesadas;
  Logger.log("Lote listo: %s alertas revisadas, faltan %s.%s", procesadas, faltan,
    faltan > 0 ? " Vuelva a ejecutar diagnosticarImagenesPdf() para continuar." : "");
  if (faltan === 0) resumirDiagnostico_(hoja);
}

// Borra la pestana Diag_Imagenes para repetir el diagnostico desde cero.
function reiniciarDiagnosticoImagenes() {
  hojaDiagnostico_(abrirHoja_(), true);
  Logger.log("Diag_Imagenes reiniciada.");
}

function hojaDiagnostico_(ss, limpiar) {
  var hoja = ss.getSheetByName("Diag_Imagenes") || ss.insertSheet("Diag_Imagenes");
  var enc = ["clave", "titulo", "kb_pdf", "imagenes_en_pdf", "jpeg_encontrados", "jpeg_elegido", "nivel",
    "otras_imagenes", "foto"];
  var actual = hoja.getLastRow() > 0 ? hoja.getRange(1, 1, 1, enc.length).getValues()[0].join("|") : "";
  if (limpiar || actual !== enc.join("|")) {
    hoja.getImages().forEach(function(img) { img.remove(); });
    hoja.clear();
    hoja.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight("bold");
    hoja.setColumnWidth(8, 260);
    hoja.setColumnWidth(9, 320);
  }
  return hoja;
}

function diagnosticarPdf_(hoja, h) {
  var fila = hoja.getLastRow() + 1;
  var resultado = { kbPdf: 0, totalImagenes: 0, jpegs: [], otras: [] };
  var error = "";
  try {
    Utilities.sleep(ESPERA_FUENTES_MS);
    var resp = UrlFetchApp.fetch(String(h.url_pdf), { muteHttpExceptions: true, headers: { "User-Agent": USER_AGENT } });
    if (resp.getResponseCode() !== 200) throw new Error("HTTP " + resp.getResponseCode());
    var bytes = resp.getBlob().getBytes();
    resultado = extraerJpegsPdf_(bytes);
    resultado.kbPdf = Math.round(bytes.length / 1024);
  } catch (e) {
    error = String(e);
  }
  var elegida = elegirFoto_(resultado.jpegs);
  var jpegs = resultado.jpegs.map(function(j) { return j.kb + " KB " + j.ancho + "x" + j.alto; }).join("; ");
  hoja.getRange(fila, 1, 1, 8).setValues([[h.clave, tituloCorto_(String(h.titulo)), resultado.kbPdf,
    resultado.totalImagenes, error || jpegs || "ninguno",
    elegida ? elegida.kb + " KB " + elegida.ancho + "x" + elegida.alto : "—", h.nivel || "—",
    resultado.otras.join("; ") || "—"]]);
  if (elegida) {
    try {
      hoja.setRowHeight(fila, 160);
      var img = hoja.insertImage(Utilities.newBlob(elegida.bytes, "image/jpeg", h.clave + ".jpg"), 9, fila);
      var escala = Math.min(310 / (elegida.ancho || 310), 150 / (elegida.alto || 150), 1);
      img.setWidth(Math.round((elegida.ancho || 310) * escala)).setHeight(Math.round((elegida.alto || 150) * escala));
    } catch (e2) {
      hoja.getRange(fila, 9).setValue("No se pudo insertar: " + e2);
    }
  }
  Logger.log("[%s] PDF %s KB, %s imagenes, JPEG: %s | otras: %s -> foto: %s %s", h.clave, resultado.kbPdf,
    resultado.totalImagenes, jpegs || "ninguno", resultado.otras.join("; ") || "—",
    elegida ? elegida.kb + " KB" : "ninguna", error);
}

// Al terminar las 80 alertas: cuantas tienen foto por fuente y tipo (AS/IS).
function resumirDiagnostico_(hoja) {
  var conteo = {};
  leerFilas_(hoja).forEach(function(f) {
    var partes = String(f.clave).split(":");
    var grupo = partes[0] + ":" + partes[1];
    conteo[grupo] = conteo[grupo] || { total: 0, foto: 0 };
    conteo[grupo].total++;
    if (f.jpeg_elegido && f.jpeg_elegido !== "—") conteo[grupo].foto++;
  });
  Object.keys(conteo).sort().forEach(function(g) {
    Logger.log("RESUMEN %s: %s de %s con foto", g, conteo[g].foto, conteo[g].total);
  });
}

// Extrae las imagenes JPEG (/DCTDecode) incrustadas en un PDF a partir de sus bytes.
function extraerJpegsPdf_(bytes) {
  var s = Utilities.newBlob(bytes).getDataAsString("ISO-8859-1"); // 1 caracter = 1 byte
  var total = (s.match(/\/Subtype\s*\/Image/g) || []).length;
  var jpegs = [];
  var pos = 0;
  var idx;
  while ((idx = s.indexOf("/DCTDecode", pos)) >= 0) {
    pos = idx + 10;
    var inicioDic = s.lastIndexOf("<<", idx);
    var st = s.indexOf("stream", idx);
    if (st < 0) break;
    var ini = st + 6;
    if (s.charAt(ini) === "\r") ini++;
    if (s.charAt(ini) === "\n") ini++;
    if (s.charCodeAt(ini) !== 0xFF || s.charCodeAt(ini + 1) !== 0xD8) continue;
    var fin = s.indexOf("endstream", ini);
    if (fin < 0) break;
    while (fin > ini && (s.charAt(fin - 1) === "\n" || s.charAt(fin - 1) === "\r")) fin--;
    var dic = s.substring(inicioDic, st);
    jpegs.push({
      bytes: bytes.slice(ini, fin),
      kb: Math.round((fin - ini) / 1024),
      ancho: Number((dic.match(/\/Width\s+(\d+)/) || [0, 0])[1]),
      alto: Number((dic.match(/\/Height\s+(\d+)/) || [0, 0])[1])
    });
    pos = fin;
  }
  return { totalImagenes: total, jpegs: jpegs, otras: describirOtrasImagenesPdf_(s) };
}

// Describe las imagenes que no son JPEG (p. ej. /FlateDecode) para decidir si vale la pena extraerlas:
// "1200x800 FlateDecode DeviceRGB pred15 450 KB". Solo lee el diccionario y el tamano del stream.
function describirOtrasImagenesPdf_(s) {
  var otras = [];
  var re = /\/Subtype\s*\/Image/g;
  var m;
  while ((m = re.exec(s)) !== null) {
    var inicioDic = s.lastIndexOf("<<", m.index);
    var st = s.indexOf("stream", m.index);
    if (inicioDic < 0 || st < 0) continue;
    var dic = s.substring(inicioDic, st);
    if (dic.indexOf("/DCTDecode") >= 0) continue;
    var fin = s.indexOf("endstream", st);
    var filtro = (dic.match(/\/Filter\s*\[?\s*\/(\w+)/) || [0, "sin filtro"])[1];
    var color = (dic.match(/\/ColorSpace\s*\/(\w+)/) || [0, "otro"])[1];
    var pred = (dic.match(/\/Predictor\s+(\d+)/) || [0, ""])[1];
    otras.push(Number((dic.match(/\/Width\s+(\d+)/) || [0, 0])[1]) + "x" +
      Number((dic.match(/\/Height\s+(\d+)/) || [0, 0])[1]) + " " + filtro + " " + color +
      (pred ? " pred" + pred : "") + (dic.indexOf("/SMask") >= 0 ? " alfa" : "") + " " +
      Math.round(Math.max(0, fin - st) / 1024) + " KB");
  }
  return otras;
}

// Fotos candidatas, de mayor a menor: se descartan logos y sellos (< 15 KB) y franjas de
// encabezado o pie de pagina (un lado mas de 5 veces el otro, p. ej. 1649x195).
function fotosCandidatas_(jpegs) {
  return jpegs.filter(function(j) {
    var franja = j.ancho > 0 && j.alto > 0 && Math.max(j.ancho / j.alto, j.alto / j.ancho) > PROPORCION_MAX_FOTO;
    return j.kb >= 15 && !franja;
  }).sort(function(a, b) { return b.bytes.length - a.bytes.length; });
}

// La foto del producto suele ser la candidata mas grande.
function elegirFoto_(jpegs) {
  return fotosCandidatas_(jpegs)[0] || null;
}

// Registra los enlaces internos a /alertas/... para verificar rutas.
function registrarEnlacesAlertas_(html) {
  var vistos = {};
  var re = /href=["']([^"']*\/alertas\/[^"'?#]+)["']/gi;
  var m;
  while ((m = re.exec(html)) !== null) vistos[m[1]] = true;
  var lista = Object.keys(vistos);
  if (lista.length > 0) Logger.log("   Rutas /alertas/ encontradas: %s", lista.join(" | "));
}
