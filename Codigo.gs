// =====================================================================
// Bot "alertas-sanitarias-invima-hdv"
// Servicio Farmaceutico - Hospital Departamental de Villavicencio E.S.E.
// Vigila las alertas sanitarias de INVIMA (medicamentos y dispositivos
// medicos) y publica las relevantes en el grupo de WhatsApp via GREEN-API.
//
// ESTADO: Paso 1 - solo prueba de acceso a las fuentes. No envia mensajes.
// =====================================================================

var USER_AGENT = "HDV-ESE-ServicioFarmaceutico-AlertasINVIMA/0.1 (Apps Script; Villavicencio, Colombia)";

// Fuentes por defecto. En operacion normal se leeran de la pestana Config_Fuentes.
var FUENTES_DEFECTO = [
  { fuente: "MED", url: "https://app.invima.gov.co/alertas/medicamentos-productos-biologicos" },
  { fuente: "DM", url: "https://app.invima.gov.co/alertas/dispositivos-medicos-otras-tecnologias" }
];

// Pagina indice, usada solo en la prueba de acceso para descubrir la ruta real de DM.
var URL_INDICE_ALERTAS = "https://app.invima.gov.co/alertas";

var REGEX_PDF_ALERTA = /ckfinder\/userfiles\/files\/ALERTAS[^"']+\.pdf/gi;

// ---------------------------------------------------------------------
// Paso 1 - Prueba de acceso (no envia mensajes, no escribe en la hoja)
// ---------------------------------------------------------------------

function probarAcceso() {
  var objetivos = FUENTES_DEFECTO.map(function(f) {
    return { fuente: f.fuente, url: f.url + "?page=0" };
  });
  objetivos.push({ fuente: "INDICE", url: URL_INDICE_ALERTAS });

  objetivos.forEach(function(obj, i) {
    if (i > 0) Utilities.sleep(1500);
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

// Registra los enlaces internos a /alertas/... para verificar la ruta de DM.
function registrarEnlacesAlertas_(html) {
  var vistos = {};
  var re = /href=["']([^"']*\/alertas\/[^"'?#]+)["']/gi;
  var m;
  while ((m = re.exec(html)) !== null) vistos[m[1]] = true;
  var lista = Object.keys(vistos);
  if (lista.length > 0) Logger.log("   Rutas /alertas/ encontradas: %s", lista.join(" | "));
}
