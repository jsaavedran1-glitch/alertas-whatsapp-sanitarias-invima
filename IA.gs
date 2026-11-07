// =====================================================================
// IA.gs - Lectura del PDF de cada alerta nueva con la API de Claude (Anthropic)
// Servicio Farmaceutico - Hospital Departamental de Villavicencio E.S.E.
//
// Que hace: descarga el PDF de cada alerta NUEVA y le pide a Claude que extraiga los datos del
// producto (principios activos, marcas, registros sanitarios, lotes/seriales, titular y fabricante)
// y el motivo de la alerta en una frase. Con eso:
//   1. completa la ficha (registro sanitario, lote/serial, titular) cuando la pagina de detalle de
//      INVIMA la trae vacia;
//   2. agrega esos datos al texto que clasificar_() cruza con Listado_Terapeutico, Vigilancia y
//      Reglas. La prioridad la siguen decidiendo las reglas de la hoja, no la IA, y nunca baja:
//      si con el PDF sale un nivel menor que con el titulo, se conserva el del titulo;
//   3. agrega al mensaje una linea con el motivo (MOSTRAR_MOTIVO_IA) y guarda en el Historico el
//      motivo, todos los lotes leidos y los tokens usados.
//
// Propiedades del script:
//   ANTHROPIC_API_KEY  obligatoria para usar la IA. Si falta, el bot funciona igual que antes.
//   CLAUDE_MODEL       opcional; por defecto IA_MODELO_DEFECTO.
//   IA_ACTIVA          opcional; "NO" apaga la IA sin tocar el codigo.
//
// Si la API falla (sin creditos, clave invalida, limite de uso, caida), la alerta sigue sin IA y
// queda en el registro. Prueba sin enviar ni escribir en la hoja: probarIa().
// Los PDF de INVIMA son publicos: a la API no sale ningun dato del HDV ni de pacientes.
// =====================================================================

var IA_ACTIVA = true;
var IA_MODELO_DEFECTO = "claude-sonnet-5-5";
var IA_URL = "https://api.anthropic.com/v1/messages";
var IA_VERSION_API = "2023-06-01";
var IA_MAX_POR_EJECUCION = 8;          // alertas leidas por ejecucion; las demas siguen sin IA
var IA_PRESUPUESTO_MS = 150000;        // tiempo maximo de la fase IA (Apps Script corta a los 6 min)
var IA_MAX_BYTES_PDF = 15 * 1024 * 1024;
var IA_MAX_TOKENS = 2048;
var MOSTRAR_MOTIVO_IA = true;          // false: el motivo solo queda en el Historico
var IA_MAX_MOTIVO = 140;               // caracteres del motivo en el mensaje
var IA_MAX_LOTES_FICHA = 5;            // lotes que se muestran en la ficha cuando vienen del PDF
var E_IA = 0x1F916;                    // robot

// USD por millon de tokens (entrada, salida), solo para el costo aproximado del registro.
var IA_PRECIOS_MTOK = {
  "claude-haiku-5-5": [0.10, 0.50],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20]
};

var IA_SISTEMA = [
  "Eres quimico farmaceutico del Servicio Farmaceutico de un hospital en Colombia.",
  "Recibes en PDF una alerta sanitaria o un informe de seguridad publicado por el INVIMA.",
  "Responde solo con el JSON pedido, con los datos del producto objeto de la alerta.",
  "Reglas:",
  "- Copia registros sanitarios, lotes y seriales exactamente como aparecen, sin corregirlos ni completarlos.",
  "- Si un dato no aparece en el documento, deja la lista vacia o la cadena vacia. No inventes datos.",
  "- Si la alerta cubre varios productos o presentaciones, incluyelos todos.",
  "- Incluye solo los productos objeto de la alerta; no incluyas medicamentos o dispositivos mencionados " +
    "solo como contexto (interacciones, alternativas terapeuticas, ejemplos).",
  "- Escribe en espa\u00f1ol."
].join("\n");

// Formato de la respuesta (structured outputs, output_config.format). Sonnet 5.5 no admite
// tool_choice forzado, por eso no se usa una herramienta.
var IA_ESQUEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    producto: { type: "string", description: "Nombre del producto o productos afectados, como aparece en el documento." },
    principios_activos: { type: "array", items: { type: "string" },
      description: "Principios activos (DCI) de los medicamentos afectados. En dispositivos medicos, el nombre generico del dispositivo (p. ej. cateter venoso central)." },
    marcas: { type: "array", items: { type: "string" }, description: "Marcas o nombres comerciales del producto afectado." },
    registros_sanitarios: { type: "array", items: { type: "string" }, description: "Registros sanitarios INVIMA, exactamente como aparecen." },
    lotes: { type: "array", items: { type: "string" },
      description: "Lotes o seriales afectados, exactamente como aparecen. Vacio si el documento no los menciona." },
    titular_fabricante: { type: "array", items: { type: "string" },
      description: "Titular del registro, fabricante, importador o distribuidor mencionados." },
    tipo_problema: { type: "string", enum: ["falsificacion", "sin_registro_o_fraudulento", "calidad",
      "retiro_del_mercado", "seguridad_clinica", "uso_o_comercializacion_irregular", "otro"] },
    motivo: { type: "string",
      description: "Una frase de maximo 140 caracteres: que problema tiene el producto. Sin repetir el nombre del producto." },
    dirigida_a_ips: { type: "boolean",
      description: "true si el documento trae medidas o recomendaciones dirigidas a IPS, hospitales o servicios farmaceuticos." }
  },
  required: ["producto", "principios_activos", "marcas", "registros_sanitarios", "lotes", "titular_fabricante",
    "tipo_problema", "motivo", "dirigida_a_ips"]
};

// =====================================================================
// Funcion publica de prueba
// =====================================================================

// No envia nada ni escribe en la hoja: toma la alerta mas reciente de cada fuente activa, lee su
// detalle y su PDF con la IA y muestra en el registro lo extraido y el mensaje que saldria.
function probarIa() {
  var cfg = iaConfig_();
  if (!cfg.activa) {
    Logger.log("IA no disponible: %s. Agregue ANTHROPIC_API_KEY en Propiedades del script.", cfg.motivo);
    return;
  }
  var ss = abrirHoja_();
  var reglas = cargarReglas_(ss);
  leerFuentes_(ss).forEach(function(f, i) {
    if (i > 0) Utilities.sleep(ESPERA_FUENTES_MS);
    var r = descargar_(urlPagina_(f.url, 0));
    var it = ((r.codigo === 200) ? parsearListado_(r.html, f.fuente) : [])[0];
    if (!it) {
      Logger.log("[%s] No se pudo leer el listado (HTTP %s).", f.fuente, r.codigo);
      return;
    }
    leerDetalle_(it);
    clasificar_(it, reglas);
    var antes = it.nivel + " | " + (it.coincidencia || "sin coincidencia");
    enriquecerConIa_([it], reglas);
    Logger.log("[%s] %s\nAntes de la IA: %s\nIA (%s): %s\nDespues de la IA: %s | %s\n\n%s", f.fuente, it.clave, antes,
      cfg.modelo, it.ia ? JSON.stringify(it.ia, null, 1) : "sin resultado", it.nivel, it.coincidencia || "sin coincidencia",
      formatearMensaje_(it));
  });
}

// =====================================================================
// Flujo
// =====================================================================

function iaConfig_() {
  var props = PropertiesService.getScriptProperties();
  var clave = props.getProperty("ANTHROPIC_API_KEY");
  var apagada = !IA_ACTIVA || normalizar_(props.getProperty("IA_ACTIVA") || "SI") === "NO";
  return {
    activa: !apagada && !!clave,
    clave: clave,
    modelo: props.getProperty("CLAUDE_MODEL") || IA_MODELO_DEFECTO,
    motivo: apagada ? "IA apagada (IA_ACTIVA)" : (!clave ? "falta ANTHROPIC_API_KEY" : "")
  };
}

// Lee con la IA el PDF de cada alerta (hasta IA_MAX_POR_EJECUCION y dentro de IA_PRESUPUESTO_MS),
// completa la ficha y reclasifica. Nunca lanza error: si algo falla, la alerta sigue sin IA.
function enriquecerConIa_(items, reglas) {
  var res = { analizadas: 0, subieron: 0, completadas: 0, errores: 0, entrada: 0, salida: 0 };
  if (!items || items.length === 0) return res;
  var cfg = iaConfig_();
  if (!cfg.activa) {
    Logger.log("IA: no se usa (%s).", cfg.motivo);
    return res;
  }
  var inicio = Date.now();
  for (var k = 0; k < items.length; k++) {
    if (res.analizadas >= IA_MAX_POR_EJECUCION || Date.now() - inicio > IA_PRESUPUESTO_MS) {
      Logger.log("IA: limite de la ejecucion alcanzado; %s alerta(s) siguen sin IA.", items.length - k);
      break;
    }
    var it = items[k];
    var r;
    try {
      r = analizarPdfConIa_(it, cfg);
    } catch (e) {
      r = { ok: false, error: ocultar_(String(e), cfg.clave) };
    }
    if (!r.ok) {
      res.errores++;
      Logger.log("[%s] IA sin resultado: %s", it.clave, r.error || "");
      if (r.detener) {
        Logger.log("IA detenida en esta ejecucion; las demas alertas siguen sin IA.");
        break;
      }
      continue;
    }
    res.analizadas++;
    res.entrada += it.ia.tokensEntrada;
    res.salida += it.ia.tokensSalida;
    var antes = it.nivel;
    try {
      if (aplicarIa_(it, reglas)) res.completadas++;
    } catch (e2) {
      Logger.log("[%s] IA: no se pudo aplicar el resultado (%s).", it.clave, e2);
    }
    if (antes && ordenNivel_(it.nivel) < ordenNivel_(antes)) {
      res.subieron++;
      Logger.log("[%s] IA: nivel %s -> %s (%s)", it.clave, antes, it.nivel, it.coincidencia || "");
    }
  }
  if (res.analizadas + res.errores > 0) {
    var costo = costoIa_(cfg.modelo, res.entrada, res.salida);
    Logger.log("IA (%s): %s leida(s), %s subieron de nivel, %s ficha(s) completada(s), %s error(es); tokens %s/%s%s.",
      cfg.modelo, res.analizadas, res.subieron, res.completadas, res.errores, res.entrada, res.salida,
      costo === null ? "" : ", aprox. USD " + costo.toFixed(4));
  }
  return res;
}

// Descarga el PDF de la alerta y lo envia a la API. Devuelve { ok } y deja el resultado en it.ia, o
// { ok: false, error, detener } (detener: no tiene sentido seguir en esta ejecucion).
function analizarPdfConIa_(it, cfg) {
  if (!it.url || !/(\.pdf|\/pdf)$/i.test(it.url)) return { ok: false, error: "la alerta no tiene PDF" };
  var pdf = UrlFetchApp.fetch(it.url, { muteHttpExceptions: true, followRedirects: true, headers: { "User-Agent": USER_AGENT } });
  if (pdf.getResponseCode() !== 200) return { ok: false, error: "PDF HTTP " + pdf.getResponseCode() };
  var bytes = pdf.getBlob().getBytes();
  if (!esPdf_(bytes)) return { ok: false, error: "el enlace no devolvio un PDF" };
  if (bytes.length > IA_MAX_BYTES_PDF) return { ok: false, error: "PDF de " + Math.round(bytes.length / 1048576) + " MB" };

  var cuerpo = {
    model: cfg.modelo,
    max_tokens: IA_MAX_TOKENS,
    system: IA_SISTEMA,
    output_config: { format: { type: "json_schema", schema: IA_ESQUEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: Utilities.base64Encode(bytes) } },
        { type: "text", text: contextoIa_(it) }
      ]
    }]
  };
  var resp;
  try {
    resp = UrlFetchApp.fetch(IA_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(cuerpo),
      muteHttpExceptions: true,
      headers: { "x-api-key": cfg.clave, "anthropic-version": IA_VERSION_API }
    });
  } catch (e) {
    return { ok: false, detener: true, error: "API: " + ocultar_(String(e), cfg.clave) };
  }
  var codigo = resp.getResponseCode();
  var texto = resp.getContentText();
  if (codigo !== 200) {
    var detalle = ocultar_(texto.substring(0, 300), cfg.clave);
    // 400/413 suelen ser de este PDF y se sigue con la siguiente alerta; sin creditos, clave invalida,
    // modelo inexistente, limite de uso o caida de la API se detiene la IA en esta ejecucion.
    var detener = (codigo !== 400 && codigo !== 413) || /credit balance/i.test(texto);
    return { ok: false, detener: detener, error: "API HTTP " + codigo + ": " + detalle };
  }
  var datos;
  try {
    datos = JSON.parse(texto);
  } catch (e2) {
    return { ok: false, error: "respuesta de la API no es JSON" };
  }
  if (datos.stop_reason === "refusal") return { ok: false, error: "la API no proceso el documento (refusal)" };
  if (datos.stop_reason === "max_tokens") return { ok: false, error: "respuesta cortada (max_tokens)" };
  var bloque = (datos.content || []).filter(function(b) { return b.type === "text" && b.text; })[0];
  var entrada;
  try {
    entrada = JSON.parse(bloque.text);
  } catch (e3) {
    return { ok: false, error: "la respuesta no trae los datos (" + (datos.stop_reason || "") + ")" };
  }
  it.ia = normalizarRespuestaIa_(entrada);
  it.ia.modelo = cfg.modelo;
  it.ia.tokensEntrada = (datos.usage && datos.usage.input_tokens) || 0;
  it.ia.tokensSalida = (datos.usage && datos.usage.output_tokens) || 0;
  return { ok: true };
}

// Completa los campos vacios de la ficha con lo leido en el PDF y reclasifica con clasificar_(), que
// suma it.textoIa al texto que cruza con la hoja. Si el nivel resultante es menor, se conserva el
// anterior. Devuelve true si completo algun campo de la ficha.
function aplicarIa_(it, reglas) {
  var ia = it.ia;
  var completo = [];
  if (!valorDetalle_(it.registroSanitario) && ia.registros.length > 0) {
    it.registroSanitario = listaCorta_(ia.registros, 3);
    completo.push("registro");
  }
  if (!valorDetalle_(it.loteSerial) && ia.lotes.length > 0) {
    it.loteSerial = listaCorta_(ia.lotes, IA_MAX_LOTES_FICHA);
    completo.push("lote");
  }
  if (!valorDetalle_(it.titular) && ia.titular.length > 0) {
    it.titular = ia.titular[0];
    completo.push("titular");
  }
  ia.completo = completo;
  it.textoIa = [ia.producto].concat(ia.principios, ia.marcas, ia.registros, ia.lotes, ia.titular)
    .filter(function(x) { return x; }).join(" ; ");
  var antes = { nivel: it.nivel, coincidencia: it.coincidencia };
  clasificar_(it, reglas);
  if (antes.nivel && ordenNivel_(it.nivel) > ordenNivel_(antes.nivel)) {
    it.nivel = antes.nivel;
    if (!it.coincidencia) it.coincidencia = antes.coincidencia;
  }
  return completo.length > 0;
}

// =====================================================================
// Mensaje e Historico (llamadas desde Codigo.gs)
// =====================================================================

// Linea del mensaje con el motivo leido en el PDF, o "" si no hay.
function lineaIa_(it) {
  if (!MOSTRAR_MOTIVO_IA || !it.ia || !it.ia.motivo) return "";
  var origen = (it.ia.completo && it.ia.completo.length > 0) ? "motivo y ficha le\u00eddos del PDF" : "lectura autom\u00e1tica del PDF";
  return emoji_(E_IA) + " *Motivo:* " + it.ia.motivo + " _(" + origen + ")_";
}

// Columnas ia_motivo, ia_lotes e ia_tokens del Historico (siempre 3 valores).
function filaIa_(it) {
  if (!it.ia) return ["", "", ""];
  return [it.ia.motivo || "", it.ia.lotes.join("; "),
    it.ia.tokensEntrada + "/" + it.ia.tokensSalida + " " + it.ia.modelo];
}

// Antes de escribir en el Historico: columnas suficientes y encabezados de las columnas nuevas.
// Solo llena celdas de encabezado vacias; no toca las existentes.
function asegurarColumnasIa_(hoja) {
  var enc = ENCABEZADOS.Historico;
  if (hoja.getMaxColumns() < enc.length) hoja.insertColumnsAfter(hoja.getMaxColumns(), enc.length - hoja.getMaxColumns());
  var actual = hoja.getRange(1, 1, 1, enc.length).getValues()[0];
  for (var i = 0; i < enc.length; i++) {
    if (!String(actual[i] || "").trim()) hoja.getRange(1, i + 1).setValue(enc[i]).setFontWeight("bold");
  }
}

// =====================================================================
// Auxiliares
// =====================================================================

function contextoIa_(it) {
  var lineas = [
    "Documento: " + encabezado_(it) + " (" + (it.fuente === "DM" ? "dispositivos medicos" : "medicamentos y productos biologicos") + ")",
    "Titulo en el sitio de INVIMA: " + it.titulo
  ];
  if (valorDetalle_(it.productoDetalle)) lineas.push("Producto segun la pagina de detalle: " + it.productoDetalle);
  lineas.push("Responde con el JSON de los datos del producto.");
  return lineas.join("\n");
}

function normalizarRespuestaIa_(x) {
  var motivo = limpiarIa_(x.motivo);
  if (motivo.length > IA_MAX_MOTIVO) motivo = motivo.substring(0, IA_MAX_MOTIVO - 1).replace(/\s+\S*$/, "") + "\u2026";
  return {
    producto: limpiarIa_(x.producto),
    principios: listaIa_(x.principios_activos),
    marcas: listaIa_(x.marcas),
    registros: listaIa_(x.registros_sanitarios),
    lotes: listaIa_(x.lotes),
    titular: listaIa_(x.titular_fabricante),
    tipoProblema: String(x.tipo_problema || "").trim(),
    motivo: motivo,
    dirigidaIps: x.dirigida_a_ips === true
  };
}

// Sin los signos de formato de WhatsApp (* _ ~ y comilla invertida, cambiados por espacio) ni espacios de mas.
function limpiarIa_(s) {
  return String(s === undefined || s === null ? "" : s).replace(/[*_~\x60]/g, " ").replace(/\s+/g, " ").trim();
}

// Lista sin vacios, sin "N/A" ni repetidos (comparando normalizado).
function listaIa_(v) {
  var vistos = {};
  return (Array.isArray(v) ? v : (v ? [v] : [])).map(limpiarIa_).filter(function(s) {
    var n = normalizar_(s);
    if (!n || /^(N A|NA|NO APLICA|NINGUNO|NINGUNA|SIN DATO|SIN INFORMACION|NO REPORTA|NO INDICA)$/.test(n) || vistos[n]) return false;
    vistos[n] = true;
    return true;
  });
}

function listaCorta_(lista, max) {
  return lista.slice(0, max).join(", ") + (lista.length > max ? " y " + (lista.length - max) + " m\u00e1s" : "");
}

// "%PDF" al inicio.
function esPdf_(bytes) {
  return !!bytes && bytes.length > 4 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70;
}

function costoIa_(modelo, entrada, salida) {
  var p = IA_PRECIOS_MTOK[modelo];
  return p ? (entrada * p[0] + salida * p[1]) / 1e6 : null;
}
