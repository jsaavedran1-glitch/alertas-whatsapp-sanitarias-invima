// =====================================================================
// Bot "alertas-sanitarias-invima-hdv"
// Servicio Farmaceutico - Hospital Departamental de Villavicencio E.S.E.
// Vigila las alertas sanitarias de INVIMA (medicamentos y dispositivos
// medicos) y publica las relevantes en el grupo de WhatsApp via GREEN-API.
//
// Funciones publicas (orden de puesta en marcha):
//   inicializarHoja() -> cargaInicial() -> probarSinEnviar() -> instalarDisparadores()
// Operacion: revisarAlertas() y resumenSemanal() (por disparador).
// Diagnostico (solo lectura): probarAcceso(), volcarMuestraHtml().
// =====================================================================

var TZ = "America/Bogota";
var USER_AGENT = "HDV-ESE-ServicioFarmaceutico-AlertasINVIMA/1.0 (Apps Script; Villavicencio, Colombia)";
var BASE_INVIMA = "https://app.invima.gov.co";

var MAX_MENSAJES = 10;           // por ejecucion; si hay mas, un solo mensaje agrupado
var ESPERA_MENSAJES_MS = 2000;   // entre mensajes de WhatsApp
var ESPERA_FUENTES_MS = 1500;    // entre descargas a INVIMA
var MAX_BAJA_RESUMEN = 40;       // titulos BAJA listados en el resumen semanal
var LONGITUD_MIN_TERMINO = 4;    // catalogo y Vigilancia: evita coincidencias espurias con nombres cortos
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
  Catalogo_HDV: ["codigo", "descripcion", "principio_activo", "marca", "tipo"],
  Reglas: ["termino", "nivel"],
  Vigilancia: ["principio_activo"],
  Log: ["fecha", "fuente", "leidos", "nuevos", "enviados", "estado", "error"]
};

var PRECARGA = {
  Config_Fuentes: FUENTES_DEFECTO.map(function(f) { return [f.fuente, f.url, "SI"]; }),
  Reglas: [
    ["FALSIFICACIÓN", "MEDIA"], ["FALSIFICADO", "MEDIA"], ["FRAUDULENTO", "MEDIA"], ["LOTE", "MEDIA"],
    ["RETIRO", "MEDIA"], ["RECALL", "MEDIA"], ["CALIDAD", "MEDIA"], ["CONTAMINACIÓN", "MEDIA"],
    ["INFORME DE SEGURIDAD", "MEDIA"], ["DESABASTECIMIENTO", "MEDIA"],
    ["COMERCIO ELECTRÓNICO", "BAJA"], ["SUPLEMENTO", "BAJA"], ["HOMEOPÁTICO", "BAJA"], ["CBD", "BAJA"]
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
  return ejecutar_({ nombre: "REVISION", enviar: true, persistir: true, paginas: 1 });
}

// Todo el flujo, con los mensajes escritos en el registro en vez de enviarse.
// No escribe en el Historico, para no consumir claves.
function probarSinEnviar() {
  var r = ejecutar_({ nombre: "PRUEBA", enviar: false, persistir: false, paginas: 1 });
  resumenSemanal_(false);
  return r;
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
        items.forEach(function(it) {
          if (claves[it.clave]) return;
          claves[it.clave] = true;
          clasificar_(it, reglas);
          it.fechaDeteccion = new Date();
          nuevos.push(it);
          reg.nuevos++;
        });
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

  var lotes = (inmediatos.length <= MAX_MENSAJES)
    ? inmediatos.map(function(it) { return { mensaje: formatearMensaje_(it), items: [it] }; })
    : [{ mensaje: formatearAgrupado_(inmediatos), items: inmediatos }];

  var cuotaAgotada = false;
  lotes.forEach(function(lote, i) {
    var estado;
    if (cuotaAgotada) {
      estado = ENVIADO.CUOTA;
    } else {
      if (i > 0) Utilities.sleep(ESPERA_MENSAJES_MS);
      var r = enviarWhatsApp_(lote.mensaje, modo.enviar);
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
    "\nFuente: " + fallidas.join(", ");
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

  var lineas = ["[INVIMA] " + emoji_(0x1F4CA) + " Resumen semanal " +
    Utilities.formatDate(desde, TZ, "dd/MM/yyyy") + " - " + Utilities.formatDate(hasta, TZ, "dd/MM/yyyy")];
  var fuentesResumen = Object.keys(conteo).sort();
  if (fuentesResumen.length === 0) lineas.push("Sin alertas nuevas detectadas en la semana.");
  fuentesResumen.forEach(function(fu) {
    var c = conteo[fu];
    lineas.push(fu + ": " + emojiNivel_("ALTA") + " " + c.ALTA + " | " + emojiNivel_("MEDIA") + " " + c.MEDIA +
      " | " + emojiNivel_("BAJA") + " " + c.BAJA);
  });
  if (bajas.length > 0) {
    lineas.push("", "Baja prioridad (" + bajas.length + "):");
    bajas.slice(0, MAX_BAJA_RESUMEN).forEach(function(f) {
      lineas.push("- [" + f.fuente + "] " + f.titulo, "  " + f.url_pdf);
    });
    if (bajas.length > MAX_BAJA_RESUMEN) lineas.push("... y " + (bajas.length - MAX_BAJA_RESUMEN) + " mas en la hoja Historico.");
  }
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

// Coincidencia por tokens completos (admite terminos de varias palabras).
function contieneTermino_(textoNorm, terminoNorm) {
  if (!terminoNorm) return false;
  return (" " + textoNorm + " ").indexOf(" " + terminoNorm + " ") >= 0;
}

function cargarReglas_(ss) {
  var reglas = { ALTA: [], MEDIA: [], BAJA: [], catalogo: [], vigilancia: [] };
  leerFilas_(ss.getSheetByName("Reglas")).forEach(function(r) {
    var nivel = normalizar_(r.nivel);
    var t = normalizar_(r.termino);
    if (t && reglas[nivel]) reglas[nivel].push({ norm: t, texto: String(r.termino).trim() });
  });
  leerFilas_(ss.getSheetByName("Catalogo_HDV")).forEach(function(c) {
    var terminos = [normalizar_(c.principio_activo), normalizar_(c.marca)].filter(function(t) {
      return t.length >= LONGITUD_MIN_TERMINO;
    });
    if (terminos.length === 0) return;
    reglas.catalogo.push({
      terminos: terminos,
      tipo: normalizar_(c.tipo),
      etiqueta: String(c.descripcion || c.principio_activo).trim() + (c.codigo ? " (" + c.codigo + ")" : "")
    });
  });
  leerFilas_(ss.getSheetByName("Vigilancia")).forEach(function(v) {
    var t = normalizar_(v.principio_activo);
    if (t.length >= LONGITUD_MIN_TERMINO) reglas.vigilancia.push({ norm: t, texto: String(v.principio_activo).trim() });
  });
  return reglas;
}

// ALTA: catalogo HDV, Vigilancia o regla ALTA. BAJA: termino BAJA sin coincidencia ALTA.
// MEDIA: termino MEDIA o tipo "Informe de seguridad". BAJA: el resto.
function clasificar_(it, reglas) {
  var t = normalizar_(it.titulo);
  var coincidencias = [];
  reglas.catalogo.forEach(function(c) {
    if (c.tipo && c.tipo !== it.fuente) return;
    if (c.terminos.some(function(x) { return contieneTermino_(t, x); })) coincidencias.push(c.etiqueta);
  });
  reglas.vigilancia.forEach(function(v) {
    if (contieneTermino_(t, v.norm)) coincidencias.push("Vigilancia: " + v.texto);
  });
  reglas.ALTA.forEach(function(r) {
    if (contieneTermino_(t, r.norm)) coincidencias.push("Regla: " + r.texto);
  });
  var hay = function(lista) { return lista.some(function(r) { return contieneTermino_(t, r.norm); }); };

  if (coincidencias.length > 0) {
    it.nivel = "ALTA";
  } else if (hay(reglas.BAJA)) {
    it.nivel = "BAJA";
  } else if (hay(reglas.MEDIA) || it.tipoCodigo === "IS") {
    it.nivel = "MEDIA";
  } else {
    it.nivel = "BAJA";
  }
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

function emojiNivel_(nivel) {
  return emoji_({ ALTA: 0x1F534, MEDIA: 0x1F7E0, BAJA: 0x26AA }[nivel]);
}

function encabezado_(it) {
  var base = it.tipoCodigo === "IS" ? "Informe de seguridad" : "Alerta sanitaria";
  return base + (it.numero ? " No. " + it.numero + "-" + it.anio : "");
}

function formatearMensaje_(it) {
  var lineas = [
    "[INVIMA-" + it.fuente + "] " + emojiNivel_(it.nivel) + " " + encabezado_(it),
    it.titulo,
    "Tipo: " + (it.tipo || "—") + " | Publicada: " + (it.fecha || "—")
  ];
  if (it.idDm || it.estadoDm) lineas.push("ID INVIMA: " + (it.idDm || "—") + " | Estado: " + (it.estadoDm || "—"));
  if (it.coincidencia) lineas.push("Coincidencia HDV: " + it.coincidencia);
  lineas.push("PDF: " + it.url);
  return lineas.join("\n");
}

// Mensaje unico cuando hay mas de MAX_MENSAJES alertas inmediatas en una ejecucion.
function formatearAgrupado_(items) {
  var lineas = ["[INVIMA] " + items.length + " alertas nuevas ALTA/MEDIA (resumen agrupado)"];
  items.forEach(function(it) {
    lineas.push("", emojiNivel_(it.nivel) + " [" + it.fuente + "] " + encabezado_(it) + " - " + it.titulo);
    if (it.coincidencia) lineas.push("Coincidencia HDV: " + it.coincidencia);
    lineas.push(it.url);
  });
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
  try {
    var resp = UrlFetchApp.fetch(apiUrl.replace(/\/+$/, "") + "/waInstance" + id + "/sendMessage/" + token, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chatId: chatId, message: mensaje }),
      muteHttpExceptions: true
    });
    var codigo = resp.getResponseCode();
    if (codigo === 200) return { ok: true, codigo: codigo };
    if (codigo === 466) {
      Logger.log("GREEN-API 466: cuota mensual excedida. No se reintenta.");
      return { ok: false, cuota: true, codigo: codigo, error: "HTTP 466 cuota excedida" };
    }
    var cuerpo = ocultar_(resp.getContentText().substring(0, 300), token);
    Logger.log("GREEN-API HTTP %s: %s", codigo, cuerpo);
    return { ok: false, codigo: codigo, error: "HTTP " + codigo };
  } catch (err) {
    var msg = ocultar_(String(err), token);
    Logger.log("GREEN-API excepcion: %s", msg);
    return { ok: false, error: msg };
  }
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

// Registra los enlaces internos a /alertas/... para verificar rutas.
function registrarEnlacesAlertas_(html) {
  var vistos = {};
  var re = /href=["']([^"']*\/alertas\/[^"'?#]+)["']/gi;
  var m;
  while ((m = re.exec(html)) !== null) vistos[m[1]] = true;
  var lista = Object.keys(vistos);
  if (lista.length > 0) Logger.log("   Rutas /alertas/ encontradas: %s", lista.join(" | "));
}
