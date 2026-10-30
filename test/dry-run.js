// test/dry-run.js
//
// Carga Codigo.gs en Node.js con simulaciones de UrlFetchApp, SpreadsheetApp,
// PropertiesService, LockService, ScriptApp, Logger y Utilities, y ejecuta el
// flujo completo contra HTML de ejemplo tomado del sitio real (2026-10-20),
// SIN acceder a INVIMA, SIN credenciales reales y SIN enviar nada.
//
// Uso: npm test   (o: node test/dry-run.js)

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const util = require("util");
const assert = require("assert");

const TOKEN = "TOKEN-SECRETO-DE-PRUEBA";
const CODIGO = fs.readFileSync(path.join(__dirname, "..", "Codigo.gs"), "utf8");

// ---------------------------------------------------------------------
// HTML de ejemplo (marcado real observado con volcarMuestraHtml)
// ---------------------------------------------------------------------

function filaMed(titulo, archivo) {
  return '<div class="views-row views-row-1 views-row-odd alertas-invima-list"> ' +
    '<div class="views-field views-field-type"> <div class="field-content alertas_sanitarias_medicamentos_">alertas_sanitarias_medicamentos_</div> </div> ' +
    '<div class="views-field views-field-title"> <span class="field-content">' + titulo + ' </span> </div> ' +
    '<div class="views-field views-field-field-tipo-de-documento"> <div class="field-content">Alerta sanitaria</div> </div> ' +
    '<div class="views-field views-field-field-a-o"> <div class="field-content">2016-10-14</div> </div> ' +
    '<span class="views-field views-field-field-comunicado-invima"> <span class="field-content"><a href="https://app.invima.gov.co/alertas/ckfinder/userfiles/files/ALERTAS%20SANITARIAS/medicamentos_pbiologicos/2026/OCTUBRE/' +
    archivo + '" target="_blank">Ver</a></span> </span> </div> ';
}

function filaDm(titulo, idDm, tipo, carpeta, archivo) {
  return '<div class="views-row views-row-1 views-row-odd alertas-invima-list"> ' +
    '<div class="views-field views-field-type"> <div class="field-content alertas_sanitarias_dispositivos_">alertas_sanitarias_dispositivos_</div> </div> ' +
    '<div class="views-field views-field-title"> <span class="field-content">' + titulo + '</span> </div> ' +
    '<div class="views-field views-field-field-numero-de-id-d-m"> <div class="field-content">' + idDm + '</div> </div> ' +
    '<span class="views-field views-field-field-estado"> <div class="field-content">SEGUIMIENTO</div> </span> ' +
    '<div class="views-field views-field-field-tipo-de-documento"> <div class="field-content">' + tipo + '</div> </div> ' +
    '<div class="views-field views-field-field-a-o"> <div class="field-content">2026-10-19</div> </div> ' +
    '<span class="views-field views-field-field-comunicado-invima"> <span class="field-content"><a href="https://app.invima.gov.co/alertas/ckfinder/userfiles/files/' +
    carpeta + '/' + archivo + '" target="_blank">Ver</a></span> </span> </div> ';
}

// Tarjetas del sitio nuevo (Odoo, 22/10/2026), con el marcado registrado por inspeccionarSitioInvima().
function tarjeta({ dir = "dm", numero = "", titulo, slug, tipo = "alerta", estado = "", fecha, clase = "", pdfId = "" }) {
  const direccion = dir === "dd" ? "Dispositivos médicos y otras tecnologías" : "Medicamentos y productos biológicos";
  return '<article class="inv-lst-tarjeta inv-dir--' + dir + ' "> <div class="inv-lst-cinta"></div> <div class="inv-lst-cuerpo"> ' +
    '<div class="inv-lst-cabeza"> <div class="inv-lst-direccion"> <img alt="" class="inv-lst-direccion-icono" loading="lazy" src="/invima_alertas_sanitarias/static/src/img/direcciones/medicamentos.png"/> <span>' + direccion + '</span> </div> ' +
    (numero ? '<span class="inv-lst-numero">' + numero + '</span> ' : '') + '</div> ' +
    '<h2 class="inv-lst-tarjeta-titulo "> <a href="/alertas-sanitarias/' + slug + '">' + titulo + '</a> </h2> ' +
    '<div class="inv-lst-etiquetas"> <span class="inv-lst-tag inv-lst-tag--' + tipo + '">' + (tipo === "informe" ? "Informe de seguridad" : "Alerta sanitaria") + '</span> ' +
    (estado ? '<span class="inv-lst-tag inv-lst-tag--estado">' + estado + '</span> ' : '') + '</div> ' +
    '<div class="inv-lst-pie"> <span class="inv-lst-fecha"> <span data-oe-type="date" data-oe-expression="alerta.fecha_publicacion">' + fecha + '</span>' +
    (clase ? ' · ' + clase : '') + ' </span> ' +
    (pdfId ? '<a class="inv-lst-pdf" href="/alertas-sanitarias/' + pdfId + '/pdf">PDF <i class="fa fa-download"></i></a> ' : '') +
    '</div> </div> </article> ';
}
const PAGINA_NUEVA = (tarjetas) => '<html><head><title>Alertas sanitarias e informes de seguridad | Invima</title></head><body>' +
  '<span class="inv-lst-conteo"> 6.256 documentos </span> <div class="inv-lst-rejilla"> ' + tarjetas.join("") + '</div></body></html>';
const TARJETAS_MED = [
  tarjeta({ titulo: "Alerta Sanitaria sobre : SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO",
    slug: "alerta-sanitaria-sobre-suplementos-dietarios-sin-registro-sanitario", fecha: "20-10-2026", clase: "Alerta sanitaria especial" }),
  tarjeta({ numero: "358&ndash;2026", titulo: "PUMPKIN SEED OIL-HAIR BOND SOFTGELS", slug: "pumpkin-seed-oil-hair-bond-softgels",
    fecha: "16-10-2026", clase: "Producto fraudulento", pdfId: "12939" }),
  tarjeta({ numero: "357–2026", titulo: "DIALUX", slug: "dialux", fecha: "16-10-2026", clase: "Producto fraudulento", pdfId: "12938" })
];
// Paginas de detalle (HTML real del 30/10/2026, informe de Cowork), recortadas a lo que lee el bot.
const DETALLE_DIALUX = '<html><body><dl class="inv-det-datos"><div class="inv-det-dato"><dt>Dirección</dt><dd class="inv-det-dato-direccion"><img alt="" src="/x.png"/><span>Dirección de Medicamentos y Productos Biológicos</span></dd></div>' +
  '<div class="inv-det-dato"><dt>Categoría</dt><dd> Producto fraudulento — Sin registro sanitario </dd></div><div class="inv-det-dato"><dt>Fecha de publicación</dt><dd data-oe-type="date">16-10-2026</dd></div>' +
  '<div class="inv-det-dato"><dt>No. de identificación interno</dt><dd>MA2610-195</dd></div><div class="inv-det-dato"><dt>Fuente</dt><dd>DENUNCIA</dd></div></dl>' +
  '<div class="inv-det-hoja"><div class="inv-det-numero"> ALERTA No. 357-2026 </div><h1 class="inv-det-asunto ">DIALUX</h1>' +
  '<table class="table inv-alerta-tabla"><thead><tr><th>Producto</th><th>Registro sanitario</th><th>Titular</th><th>Lote / Serial</th></tr></thead>' +
  '<tbody><tr><td data-etiqueta="Producto">DIALUX</td><td data-etiqueta="Registro sanitario"> Sin registro sanitario </td><td data-etiqueta="Titular">—</td><td data-etiqueta="Lote / Serial">—</td></tr></tbody></table>' +
  '<div class="inv-det-recomendaciones"><section class="inv-det-reco"><div class="inv-det-reco-titulo"><svg></svg><h4>Recomendaciones para la comunidad en general</h4></div><div class="inv-alerta-bloque inv-det-reco-texto"><p>1. Absténgase de adquirir el producto DIALUX.</p></div></section>' +
  '<section class="inv-det-reco"><div class="inv-det-reco-titulo"><svg></svg><h4>Recomendaciones para IPS, EAPB y profesionales de la salud</h4></div><div class="inv-alerta-bloque inv-det-reco-texto"><p>En el evento de encontrar pacientes que consuman el producto DIALUX comercializado como suplemento dietario se debe indicar la suspensión del uso del producto.</p><p>1. Informar sobre los posibles riesgos para la salud que se pudieran presentar.</p><p>2. Notifique al Invima sobre la adquisición del producto mencionado con los datos suministrados por los pacientes sobre la dirección y medio de adquisición del producto fraudulento.</p></div></section></div>' +
  '<object class="inv-det-documento" type="application/pdf" data="/alertas-sanitarias/12938/pdf"></object></div></body></html>';
const DETALLE_PALACOS = '<html><body><dl class="inv-det-datos"><div class="inv-det-dato"><dt>Dirección</dt><dd class="inv-det-dato-direccion"><span>Dirección de Dispositivos Médicos y Otras Tecnologías</span></dd></div>' +
  '<div class="inv-det-dato"><dt>Categoría</dt><dd> Producto </dd></div><div class="inv-det-dato"><dt>Programa de vigilancia</dt><dd>Tecnovigilancia</dd></div>' +
  '<div class="inv-det-dato"><dt>Fecha de publicación</dt><dd data-oe-type="date">13-10-2026</dd></div><div class="inv-det-dato"><dt>No. de identificación interno</dt><dd>DI2609-00541</dd></div></dl>' +
  '<div class="inv-det-hoja"><table class="table inv-alerta-tabla"><tbody><tr><td data-etiqueta="Producto">Cementos óseos con gentamicina Heraeus® PALACOS® R+G pro 40/60/80</td>' +
  '<td data-etiqueta="Registro sanitario"> 2020DM-0003812-R1 </td><td data-etiqueta="Titular">—</td><td data-etiqueta="Lote / Serial">Todos los lotes</td></tr></tbody></table>' +
  '<section class="inv-det-reco"><div class="inv-det-reco-titulo"><h4>Información para profesionales de la salud</h4></div><div class="inv-alerta-bloque inv-det-reco-texto"><p>1.Comuníquese con el importador.</p></div></section>' +
  '<section class="inv-det-reco"><div class="inv-det-reco-titulo"><h4>Recomendaciones para IPS, EAPB y profesionales de la salud</h4></div><div class="inv-alerta-bloque inv-det-reco-texto"><p>1. Comuníquese con el importador, distribuidor o comercializador para precisar si existen recomendaciones específicas para la utilización del producto y que le indique el plan de acción a seguir; en caso de no lograrlo, póngase en contacto con el Invima.</p><p>2. Reporte al Programa Nacional de Tecnovigilancia del Invima los eventos e incidentes asociados a la utilización del dispositivo médico.</p></div></section></div></body></html>';

const TARJETAS_ALI = [
  tarjeta({ dir: "da", numero: "360–2026", titulo: "Bebida energizante XYZ sin registro sanitario", slug: "bebida-xyz",
    fecha: "20-10-2026", clase: "Producto fraudulento", pdfId: "12960" })
];
const TARJETAS_COS = [
  tarjeta({ dir: "dc", numero: "361–2026", titulo: "Crema aclaradora ABC con mercurio", slug: "crema-abc",
    fecha: "20-10-2026", clase: "Producto fraudulento", pdfId: "12961" })
];
const TARJETAS_DM = [
  tarjeta({ dir: "dd", numero: "149–2026", titulo: "Cementos óseos con gentamicina Heraeus® Cemento óseo radiopaco a base de PMMA PALACOS® R+G pro 40/60/80",
    slug: "cementos-oseos-con-gentamicina-heraeus", tipo: "informe", estado: "En seguimiento", fecha: "13-10-2026", pdfId: "12905" }),
  tarjeta({ dir: "dd", numero: "355–2026", titulo: "HemosIL AcuStar HIT-IgG (PF4-H)", slug: "hemosll-acustar-hit-igg-pf4-h",
    estado: "En seguimiento", fecha: "13-10-2026", clase: "Producto defectuoso", pdfId: "12901" })
];

const ENVOLTURA = (filas) => '<form><select id="edit-field-tipo-de-documento-value"><option>Alertas sanitarias</option></select></form>' +
  '<div class="view-content"> ' + filas.join("") + '</div><footer>INVIMA</footer>';

const MED_FILAS = [
  filaMed("Alerta sanitaria sobre: ETHIOPIAN BLACK SEED OIL", "Alerta%20No_330-2026%20-%20ETHIOPIAN%20BLACK%20SEED%20OIL.pdf"),
  filaMed("Alerta sanitaria sobre: FALSIFICACIÓN DEL PRODUCTO BUSCAPINA® COMPOSITUM NF TABLETAS RECUBIERTAS LOTE F0537A",
    "Alerta%20No_329-2026%20-%20FALSIFICACI%C3%93N%20DEL%20PRODUCTO%20BUSCAPINA%C2%AE.pdf"),
  filaMed("Alerta sanitaria sobre: CURCUMINA + CBD Z-VALERIANICUM (producto falsificado)",
    "Alerta%20No_%20321-2026%20-%20%E2%80%A2_CURCUMINA%20%2B%20CBD.pdf")
];

const DM_FILAS = [
  filaDm("Informe de seguridad sobre: Centrífugas_ROTOFIX 32", "DI2609-00563", "Informe de seguridad",
    "INFORMES%20DE%20SEGURIDAD/Dispositivos/2026/Octubre", "Informe%20de%20seguridad%20No_%20%23148-2026%20.pdf"),
  filaDm("Informe de seguridad sobre: Cementos óseos con gentamicina Heraeus® Cemento óseo radiopaco a base de PMMA PALACOS® R+G...",
    "DI2609-00541", "Informe de seguridad",
    "INFORMES%20DE%20SEGURIDAD/Dispositivos/2026/Octubre", "Informe%20de%20seguridad%20No_%20%23149-2026%20.pdf"),
  filaDm("Alerta sanitaria sobre: HemosIL AcuStar HIT-IgG (PF4-H)", "DI2610-00001", "Alerta sanitaria",
    "ALERTAS%20SANITARIAS/Dispositivos_Medicos/2026/Octubre", "Alerta%20No_%20%23355-2026%20-%20HemoslL%20AcuStar.pdf")
];

// ---------------------------------------------------------------------
// Simulaciones de los servicios de Apps Script
// ---------------------------------------------------------------------

class HojaFalsa {
  constructor(nombre) { this.nombre = nombre; this.d = []; }
  getLastRow() { return this.d.length; }
  getRange(r, c, nr = 1, nc = 1) {
    const h = this;
    const rango = {
      setValues(v) {
        v.forEach((fila, i) => {
          while (h.d.length < r + i) h.d.push([]);
          fila.forEach((x, j) => { h.d[r - 1 + i][c - 1 + j] = x; });
        });
        return rango;
      },
      setValue(x) { return rango.setValues([[x]]); },
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const fila = [];
          for (let j = 0; j < nc; j++) fila.push((h.d[r - 1 + i] || [])[c - 1 + j] ?? "");
          out.push(fila);
        }
        return out;
      },
      setFontWeight() { return rango; }
    };
    return rango;
  }
  getDataRange() {
    const nc = Math.max(1, ...this.d.map((f) => f.length));
    return this.getRange(1, 1, this.d.length, nc);
  }
  setFrozenRows() {}
  setColumnWidth() {}
  setRowHeight() {}
  clear() { this.d = []; this.imagenes = []; }
  getImages() { return (this.imagenes || []).map((img) => ({ remove: () => { this.imagenes = this.imagenes.filter((x) => x !== img); } })); }
  insertImage(blob, col, fila) {
    const img = { blob, col, fila, setWidth() { return img; }, setHeight() { return img; } };
    (this.imagenes = this.imagenes || []).push(img);
    return img;
  }
  // Utilidad de prueba: filas como objetos.
  filas() {
    const [enc, ...resto] = this.d;
    return resto.map((f) => Object.fromEntries(enc.map((h, i) => [h, f[i]])));
  }
}

function crearEntorno(opciones = {}) {
  const registro = [];
  const enviados = [];
  const urlsInvima = [];
  const urlsDetalle = [];
  const hojas = {};
  const props = Object.assign({
    SS_ID: "ss-prueba", GA_API_URL: "https://7107.api.greenapi.com", GA_ID: "710722693364",
    GA_TOKEN: TOKEN, GA_CHAT_ID: "120363412506101174@g.us"
  }, opciones.props || {});
  const triggers = [{ id: "viejo" }];
  const borrados = [];
  const creados = [];
  const estado = {
    html: { MED: ENVOLTURA(MED_FILAS), DM: ENVOLTURA(DM_FILAS), ALI: PAGINA_NUEVA(TARJETAS_ALI), COS: PAGINA_NUEVA(TARJETAS_COS) },
    codigoGreen: 200
  };

  const ss = {
    getSheetByName: (n) => hojas[n] || null,
    insertSheet: (n) => (hojas[n] = new HojaFalsa(n))
  };

  const builder = (handler) => {
    const t = { handler, partes: [] };
    const b = new Proxy({}, {
      get: (_, prop) => prop === "create"
        ? () => { creados.push(t); return t; }
        : (...a) => { t.partes.push(prop + "(" + a.join(",") + ")"); return b; }
    });
    return b;
  };

  const contexto = {
    Logger: { log: (...a) => registro.push(util.format(...a)) },
    Utilities: {
      sleep: () => {},
      newBlob: (bytes, tipo, nombre) => ({
        bytes, tipo, nombre,
        getDataAsString: () => Buffer.from(bytes.map((b) => b & 255)).toString("latin1")
      }),
      formatDate: (d, tz, fmt) => {
        const p = (n) => String(n).padStart(2, "0");
        return fmt.replace("yyyy", d.getFullYear()).replace("MM", p(d.getMonth() + 1)).replace("dd", p(d.getDate()));
      }
    },
    UrlFetchApp: {
      fetch: (url, opts) => {
        if (/green-?api/.test(url)) {
          if (url.indexOf("/lastIncomingMessages/") >= 0) {
            enviados.push({ url, lectura: true });
            return { getResponseCode: () => 200, getContentText: () => JSON.stringify(estado.entrantes || []) };
          }
          if ((estado.hostsCaidos || []).some((h) => url.indexOf(h) >= 0)) throw new Error("Exception: Error de DNS: " + url);
          enviados.push({ url, cuerpo: typeof opts.payload === "string" ? JSON.parse(opts.payload) : opts.payload, contentType: opts.contentType });
          if (estado.falloFoto && url.indexOf("sendFileByUpload") >= 0) {
            return { getResponseCode: () => estado.falloFoto, getContentText: () => "error" };
          }
          return { getResponseCode: () => estado.codigoGreen, getContentText: () => '{"idMessage":"X"}' };
        }
        urlsInvima.push(url);
        if (/\.pdf$|\/pdf$/i.test(url)) {
          const bytes = (estado.pdfs || {})[url];
          return { getResponseCode: () => (bytes ? 200 : 404), getBlob: () => ({ getBytes: () => bytes }) };
        }
        if (/\/alertas-sanitarias\/[a-z0-9_-]+$/i.test(url) && !/\/pdf$/.test(url) && !/\/page\//.test(url)) {
          urlsDetalle.push(url);
          const html = (estado.detalles || {})[url];
          return { getResponseCode: () => (html ? 200 : 404), getContentText: () => html || "" };
        }
        const fuente = /direccion=da/.test(url) ? "ALI" : /direccion=dc/.test(url) ? "COS" : /dispositivos|direccion=dd/.test(url) ? "DM" : "MED";
        const nueva = url.match(/\/page\/(\d+)/);
        const pagina = nueva ? Number(nueva[1]) - 1 : Number((url.match(/page=(\d+)/) || [0, 0])[1]);
        const html = estado.paginas && estado.paginas[fuente]
          ? (estado.paginas[fuente][pagina] || ENVOLTURA([]))
          : (pagina === 0 ? estado.html[fuente] : ENVOLTURA([]));
        return { getResponseCode: () => 200, getContentText: () => html };
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: { openById: () => ss, flush: () => {} },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => borrados.push(t),
      newTrigger: (h) => ({ timeBased: () => builder(h) }),
      WeekDay: { MONDAY: "MONDAY" }
    }
  };
  vm.createContext(contexto);
  vm.runInContext(CODIGO, contexto);
  // La encuesta de socializacion se prueba en test/encuesta.js y en las pruebas que pasan { encuesta: true }.
  if (!opciones.encuesta) contexto.ENCUESTA_ACTIVA = false;
  return { g: contexto, registro, enviados, urlsInvima, urlsDetalle, hojas, props, estado, borrados, creados };
}

function prueba(nombre, fn) {
  fn();
  console.log("OK " + nombre);
}

// ---------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------

prueba("parsearListado_ MED", () => {
  const { g } = crearEntorno();
  const items = g.parsearListado_(ENVOLTURA(MED_FILAS), "MED");
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0].clave, "MED:AS:330-2026");
  assert.strictEqual(items[0].titulo, "Alerta sanitaria sobre: ETHIOPIAN BLACK SEED OIL");
  assert.strictEqual(items[0].tipo, "Alerta sanitaria");
  assert.strictEqual(items[0].fecha, "2016-10-14");
  assert.ok(items[0].url.startsWith("https://app.invima.gov.co/alertas/ckfinder/"));
  assert.strictEqual(items[2].clave, "MED:AS:321-2026");
});

prueba("parsearListado_ DM (informes con # y numeracion propia)", () => {
  const { g } = crearEntorno();
  const items = g.parsearListado_(ENVOLTURA(DM_FILAS), "DM");
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0].clave, "DM:IS:148-2026");
  assert.strictEqual(items[0].tipoCodigo, "IS");
  assert.strictEqual(items[0].idDm, "DI2609-00563");
  assert.strictEqual(items[0].estadoDm, "SEGUIMIENTO");
  assert.strictEqual(items[2].clave, "DM:AS:355-2026");
});

prueba("sitio nuevo (Odoo): tarjetas de medicamentos con numero, fecha, clasificacion y PDF", () => {
  const { g } = crearEntorno();
  const it = g.parsearListado_(PAGINA_NUEVA(TARJETAS_MED), "MED");
  assert.strictEqual(it.length, 3);
  assert.strictEqual(it[1].clave, "MED:AS:358-2026", "&ndash; tambien sirve");
  assert.strictEqual(it[2].clave, "MED:AS:357-2026");
  assert.strictEqual(it[2].titulo, "DIALUX");
  assert.strictEqual(it[2].fecha, "2026-10-16");
  assert.strictEqual(it[2].clasificacion, "Producto fraudulento");
  assert.strictEqual(it[2].url, "https://www.invima.gov.co/alertas-sanitarias/12938/pdf");
  assert.strictEqual(it[2].urlDetalle, "https://www.invima.gov.co/alertas-sanitarias/dialux");
  // Sin numero ni PDF: clave por titulo, la fecha 20-10-2026 no se toma como numero "10-2026".
  assert.strictEqual(it[0].clave, "MED:AS:T:ALERTA SANITARIA SOBRE SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO:2026-10-20");
  assert.strictEqual(it[0].url, "https://www.invima.gov.co/alertas-sanitarias/alerta-sanitaria-sobre-suplementos-dietarios-sin-registro-sanitario");
});

prueba("sitio nuevo: dispositivos con informe de seguridad y estado; filtro por direccion", () => {
  const { g } = crearEntorno();
  const it = g.parsearListado_(PAGINA_NUEVA(TARJETAS_DM), "DM");
  assert.strictEqual(JSON.stringify(it.map((x) => x.clave)), JSON.stringify(["DM:IS:149-2026", "DM:AS:355-2026"]));
  assert.strictEqual(it[0].tipo, "Informe de seguridad");
  assert.strictEqual(it[0].estadoDm, "En seguimiento");
  assert.strictEqual(it[0].clasificacion, "");
  assert.strictEqual(g.parsearListado_(PAGINA_NUEVA(TARJETAS_MED.concat(TARJETAS_DM)), "MED").length, 3, "MED ignora tarjetas dd");
  assert.ok(g.formatearMensaje_(Object.assign(it[1], { nivel: "MEDIA" })).includes("\u{1F4C5} Publicada: 2026-10-13 · Producto defectuoso\n\u{1F194} Estado: En seguimiento"));
});

prueba("sitio nuevo: paginas /page/N, migracion de Config_Fuentes y foto desde /pdf", () => {
  const { g } = crearEntorno();
  assert.strictEqual(g.urlPagina_("https://www.invima.gov.co/alertas-sanitarias?direccion=dm", 0), "https://www.invima.gov.co/alertas-sanitarias?direccion=dm");
  assert.strictEqual(g.urlPagina_("https://www.invima.gov.co/alertas-sanitarias?direccion=dm", 2), "https://www.invima.gov.co/alertas-sanitarias/page/3?direccion=dm");
  assert.strictEqual(g.urlPagina_("https://www.invima.gov.co/alertas-sanitarias", 1), "https://www.invima.gov.co/alertas-sanitarias/page/2");
  assert.strictEqual(g.migrarUrlFuente_("https://app.invima.gov.co/alertas/medicamentos-productos-biologicos"), "https://www.invima.gov.co/alertas-sanitarias?direccion=dm");
  assert.strictEqual(g.migrarUrlFuente_("https://app.invima.gov.co/alertas/dispositivos-medicos-invima"), "https://www.invima.gov.co/alertas-sanitarias?direccion=dd");
  assert.strictEqual(g.migrarUrlFuente_("https://otra.fuente/x"), "https://otra.fuente/x");
});

prueba("cambio de sitio: lo ya registrado no se repite (con numero y sin numero) y lo nuevo se envia", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  // Config_Fuentes con las URL viejas, como esta la hoja real.
  hojas.Config_Fuentes.getRange(2, 2, 2, 1).setValues([["https://app.invima.gov.co/alertas/medicamentos-productos-biologicos"],
    ["https://app.invima.gov.co/alertas/dispositivos-medicos-invima"]]);
  hojas.Config_Fuentes.getRange(4, 3, 2, 1).setValues([["NO"], ["NO"]]);   // ALI y COS aun no activadas
  const roto = "https://app.invima.gov.co/alertas/sites/all/modules/ckeditor/ckfinder/ckfinder.html";
  hojas.Historico.getRange(5, 1, 1, 12).setValues([["MED:AS:308-2026", "MED", "308", "2026",
    "Alerta sanitaria sobre: Productos fraudulentos promocionados como medicamentos a través de comercio electrónico - Parte 6",
    "Alerta sanitaria", "2026-09-18", "", "", "BAJA", "", "RESUMEN_SEMANAL"]]);
  hojas.Historico.getRange(2, 1, 3, 12).setValues([
    ["MED:" + roto, "MED", "", "", "Alerta Sanitaria sobre : SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO", "Alerta sanitaria", "2026-10-20", roto, "", "BAJA", "", "RESUMEN_SEMANAL"],
    ["MED:AS:358-2026", "MED", "358", "2026", "PUMPKIN", "Alerta sanitaria", "", "", "", "BAJA", "", "RESUMEN_SEMANAL"],
    ["DM:IS:149-2026", "DM", "149", "2026", "Cementos", "Informe de seguridad", "", "", "", "ALTA", "", "SI"]
  ]);
  estado.paginas = {
    MED: [PAGINA_NUEVA(TARJETAS_MED.concat([tarjeta({ numero: "359–2026", titulo: "RETIRO DE LOTE BUTILBROMURO DE HIOSCINA",
      slug: "retiro", fecha: "21-10-2026", clase: "Retiro de producto", pdfId: "12950" }),
      tarjeta({ titulo: "Alerta Sanitaria sobre: Productos fraudulentos promocionados como medicamentos a través de comercio electrónico - Parte 6",
        slug: "parte-6", fecha: "18-09-2026", clase: "Alerta sanitaria especial", pdfId: "12632" }),
      tarjeta({ titulo: "Alerta Sanitaria sobre : SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO",
        slug: "suplementos-2", fecha: "05-11-2026", clase: "Alerta sanitaria especial" })]))],
    DM: [PAGINA_NUEVA(TARJETAS_DM)]
  };
  const r = g.revisarAlertas();
  assert.strictEqual(JSON.stringify(r.nuevos.map((x) => x.clave).sort()),
    JSON.stringify(["DM:AS:355-2026", "MED:AS:357-2026", "MED:AS:359-2026",
      "MED:AS:T:ALERTA SANITARIA SOBRE SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO:2026-11-05"]),
    "Parte 6 (antes 308-2026) y Suplementos del 20/10 ya estaban; Suplementos del 05/11 es otra alerta");
  const alerta = enviados.find((e) => String(e.cuerpo.message || "").includes("359-2026"));
  assert.ok(alerta.cuerpo.message.includes("\u{1F4C4} PDF: https://www.invima.gov.co/alertas-sanitarias/12950/pdf"));
  assert.ok(hojas.Log.filas().every((f) => f.estado === "OK"), "sin aviso tecnico");
});

prueba("fuentes ALI y COS: direccion da/dc, etiqueta propia y carga inicial por fuente sin tocar las demas", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  assert.strictEqual(hojas.Config_Fuentes.d.length, 5, "MED, DM, ALI y COS precargadas");
  assert.strictEqual(hojas.Config_Fuentes.d[3][1], "https://www.invima.gov.co/alertas-sanitarias?direccion=da");
  const ali = g.parsearListado_(PAGINA_NUEVA(TARJETAS_ALI.concat(TARJETAS_COS)), "ALI");
  assert.strictEqual(JSON.stringify(ali.map((x) => x.clave)), JSON.stringify(["ALI:AS:360-2026"]), "ALI ignora tarjetas dc");
  assert.strictEqual(g.etiquetaFuente_("ALI"), "\u{1F37D}\uFE0F Alimento y bebida");
  assert.strictEqual(g.etiquetaFuente_("COS"), "\u{1F9F4} Cosmético, aseo y plaguicida");
  // Hoja real: ALI y COS agregadas despues, aun inactivas. cargaInicialFuente las carga sin tocar MED/DM.
  hojas.Config_Fuentes.getRange(4, 3, 2, 1).setValues([["NO"], ["NO"]]);
  g.cargaInicialFuente("ALI");
  g.cargaInicialFuente("COS");
  const filas = hojas.Historico.filas();
  assert.strictEqual(JSON.stringify(filas.map((f) => f.clave)), JSON.stringify(["ALI:AS:360-2026", "COS:AS:361-2026"]));
  assert.ok(filas.every((f) => f.enviado === "CARGA_INICIAL"));
  assert.strictEqual(enviados.length, 0);
  // Activadas: la revision no reenvia lo cargado y una alerta nueva de alimentos sale con su prefijo.
  hojas.Config_Fuentes.getRange(4, 3, 2, 1).setValues([["SI"], ["SI"]]);
  estado.html.MED = ENVOLTURA([]); estado.html.DM = ENVOLTURA([]);
  g.cargaInicial();
  estado.html.ALI = PAGINA_NUEVA(TARJETAS_ALI.concat([tarjeta({ dir: "da", numero: "362–2026", titulo: "Leche en polvo marca QRS adulterada",
    slug: "leche-qrs", fecha: "30-10-2026", clase: "Producto fraudulento", pdfId: "12970" })]));
  g.revisarAlertas();
  const alerta = enviados.filter((e) => String(e.cuerpo.message || "").startsWith("[INVIMA-ALI]"));
  assert.strictEqual(alerta.length, 1);
  assert.ok(alerta[0].cuerpo.message.includes("*Alerta sanitaria No. 362-2026*") && alerta[0].cuerpo.message.includes("Alimento y bebida"));
  assert.ok(!enviados.some((e) => String(e.cuerpo.message || "").includes("360-2026")), "lo de la carga inicial no se envia");
});

prueba("detalle de la alerta: tabla Producto, ficha, recomendacion para IPS y lineas del mensaje", () => {
  const { g } = crearEntorno();
  const it = g.aplicarDetalle_({ clave: "MED:AS:357-2026", fuente: "MED", tipoCodigo: "AS", numero: "357", anio: "2026", titulo: "DIALUX",
    fecha: "2026-10-16", clasificacion: "Producto fraudulento", url: "https://www.invima.gov.co/alertas-sanitarias/12938/pdf", nivel: "BAJA" }, DETALLE_DIALUX);
  assert.strictEqual(it.productoDetalle, "DIALUX");
  assert.strictEqual(it.registroSanitario, "Sin registro sanitario");
  assert.strictEqual(it.titular, "—");
  assert.strictEqual(it.loteSerial, "—");
  assert.strictEqual(it.idDm, "MA2610-195");
  assert.strictEqual(it.fuenteInfo, "DENUNCIA");
  assert.strictEqual(it.categoria, "Producto fraudulento — Sin registro sanitario");
  assert.ok(it.recomendacionIps.startsWith("En el evento de encontrar pacientes que consuman el producto DIALUX"));
  assert.ok(it.recomendacionIps.length <= 350 && it.recomendacionIps.endsWith("\u2026"), "recortada a MAX_RECOMENDACION");
  const msg = g.formatearMensaje_(it);
  assert.ok(msg.includes("\n\u{1F194} ID INVIMA: MA2610-195\n\u{1F9FE} Registro sanitario: Sin registro sanitario\n"), msg);
  assert.ok(!msg.includes("Titular") && !msg.includes("Lote/Serial"), "los valores — no se muestran");
  assert.ok(!msg.includes("Recomendación INVIMA"), "por defecto el mensaje no lleva la recomendacion");
  g.MOSTRAR_RECOMENDACION_IPS = true;
  assert.ok(g.formatearMensaje_(it).includes("\u{1FA7A} *Recomendación INVIMA para IPS y profesionales:*\nEn el evento"));
  assert.ok(!g.formatearMensaje_(it, true).includes("Recomendación INVIMA"), "version corta sin recomendacion");
  g.MOSTRAR_RECOMENDACION_IPS = false;
  const dm = g.aplicarDetalle_({ fuente: "DM", tipoCodigo: "IS", numero: "149", anio: "2026", titulo: "Cementos óseos", estadoDm: "En seguimiento", nivel: "ALTA", url: "u" }, DETALLE_PALACOS);
  assert.strictEqual(dm.programa, "Tecnovigilancia");
  assert.strictEqual(dm.registroSanitario, "2020DM-0003812-R1");
  assert.strictEqual(dm.loteSerial, "Todos los lotes");
  const msgDm = g.formatearMensaje_(dm);
  assert.ok(msgDm.includes("\u{1F194} ID INVIMA: DI2609-00541 · Estado: En seguimiento\n"), msgDm);
  assert.ok(!msgDm.includes("Programa:"), "el programa de vigilancia no va en el mensaje");
  assert.ok(msgDm.includes("\u{1F9FE} Registro sanitario: 2020DM-0003812-R1 · Lote/Serial: Todos los lotes"), msgDm);
});

prueba("Vigilancia (PROA/control especial) solo aplica a medicamentos, no a dispositivos", () => {
  const { g, hojas } = entornoListo();
  hojas.Vigilancia.getRange(3, 1, 1, 1).setValues([["Gentamicina"]]);
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const dm = g.clasificar_({ fuente: "DM", tipoCodigo: "IS", titulo: "Informe de seguridad sobre: Cementos óseos con gentamicina Heraeus PALACOS R+G" }, reglas);
  assert.ok(!dm.coincidencia.includes("Vigilancia"), dm.coincidencia);
  assert.strictEqual(dm.nivel, "ALTA", "sigue ALTA por la marca Palacos del Listado Terapeutico");
  const med = g.clasificar_({ fuente: "MED", tipoCodigo: "AS", titulo: "Alerta sanitaria sobre: GENTAMICINA 80 mg/2 mL solución inyectable" }, reglas);
  assert.strictEqual(med.coincidencia, "Vigilancia: Gentamicina");
});

prueba("el lote y el titular del detalle entran en la clasificacion", () => {
  const { g, hojas } = entornoListo();
  hojas.Listado_Terapeutico.getRange(3, 1, 1, 8).setValues([["MED-0001", "Daratumumab 120 mg/mL", "Daratumumab", "Darzalex", "MED", "", "PJS0C02", "JANSSEN"]]);
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const sinDetalle = g.clasificar_({ fuente: "MED", tipoCodigo: "AS", titulo: "FALSIFICACIÓN DE SOLUCIÓN INYECTABLE 120 MG/ML" }, reglas);
  assert.strictEqual(sinDetalle.nivel, "MEDIA", "solo 'falsificacion' en el titulo");
  const conLote = g.clasificar_({ fuente: "MED", tipoCodigo: "AS", titulo: "FALSIFICACIÓN DE SOLUCIÓN INYECTABLE 120 MG/ML", loteSerial: "PJS0C02", titular: "—" }, reglas);
  assert.strictEqual(conLote.nivel, "ALTA");
  assert.ok(conLote.coincidencia.startsWith("Lote PJS0C02 dispensado en HDV: Daratumumab 120 mg/mL"), conLote.coincidencia);
  const conTitular = g.clasificar_({ fuente: "MED", tipoCodigo: "AS", titulo: "RETIRO DE PRODUCTO", titular: "JANSSEN CILAG S.A." }, reglas);
  assert.ok(conTitular.coincidencia.includes("Laboratorio proveedor HDV: JANSSEN"), conTitular.coincidencia);
});

prueba("revisarAlertas lee el detalle solo de las alertas nuevas; cargaInicial no lo lee; se guarda en Historico", () => {
  const { g, hojas, enviados, estado, urlsDetalle } = entornoListo();
  estado.detalles = { "https://www.invima.gov.co/alertas-sanitarias/dialux": DETALLE_DIALUX };
  estado.paginas = { MED: [PAGINA_NUEVA(TARJETAS_MED)], DM: [PAGINA_NUEVA(TARJETAS_DM)] };
  g.cargaInicial();
  assert.strictEqual(urlsDetalle.length, 0, "la carga inicial no abre detalles");
  estado.paginas.MED = [PAGINA_NUEVA([tarjeta({ numero: "357–2026", titulo: "DIALUX", slug: "dialux", fecha: "16-10-2026", clase: "Producto fraudulento", pdfId: "12938" })]
    .concat(TARJETAS_MED))];
  hojas.Historico.d = hojas.Historico.d.filter((f) => f[0] !== "MED:AS:357-2026");
  g.revisarAlertas();
  assert.strictEqual(JSON.stringify(urlsDetalle), JSON.stringify(["https://www.invima.gov.co/alertas-sanitarias/dialux"]), "solo la nueva");
  const msg = enviados.find((e) => String(e.cuerpo.message || e.cuerpo.caption || "").includes("357-2026")).cuerpo;
  assert.ok((msg.message || msg.caption).includes("Registro sanitario: Sin registro sanitario"));
  const fila = hojas.Historico.filas().find((f) => f.clave === "MED:AS:357-2026");
  assert.strictEqual(fila.registro_sanitario, "Sin registro sanitario");
  assert.strictEqual(fila.id_invima, "MA2610-195");
  assert.strictEqual(fila.lote_serial, "—");
});

prueba("parsearListado_ sin items y clave de respaldo por URL", () => {
  const { g } = crearEntorno();
  assert.strictEqual(g.parsearListado_("<html>error</html>", "MED").length, 0);
  const sinNumero = g.parsearListado_(ENVOLTURA([filaMed("Alerta sanitaria sobre: X", "Comunicado.pdf")]), "MED");
  assert.ok(sinNumero[0].clave.startsWith("MED:https://"), "PDF propio sin numero: clave por URL");
});

prueba("enlace roto a ckfinder.html (20/10/2026): clave por titulo, sin confundir alertas ni reprocesar la anterior", () => {
  const roto = "https://app.invima.gov.co/alertas/sites/all/modules/ckeditor/ckfinder/ckfinder.html";
  const fila = (titulo) => filaMed(titulo, "X.pdf").replace(/href="[^"]+"/, 'href="' + roto + '"');
  const { g, hojas, estado } = entornoListo();
  const items = g.parsearListado_(ENVOLTURA([fila("Alerta Sanitaria sobre : SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO"),
    fila("Alerta Sanitaria sobre : CREMA X")]), "MED");
  assert.strictEqual(items[0].clave, "MED:AS:T:ALERTA SANITARIA SOBRE SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO");
  assert.notStrictEqual(items[0].clave, items[1].clave);
  assert.strictEqual(items[0].claveAnterior, "MED:" + roto);
  // Historico ya tiene la alerta con la clave anterior (version 2:21 p. m.): no se repite; la otra si es nueva.
  hojas.Historico.getRange(2, 1, 1, 12).setValues([["MED:" + roto, "MED", "", "", "Alerta Sanitaria sobre : SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO", "Alerta sanitaria", "", roto, "", "BAJA", "", "RESUMEN_SEMANAL"]]);
  estado.html.MED = ENVOLTURA([fila("Alerta Sanitaria sobre : SUPLEMENTOS DIETARIOS SIN REGISTRO SANITARIO"), fila("Alerta Sanitaria sobre : CREMA X")]);
  estado.html.DM = ENVOLTURA([]);
  const r = g.probarSinEnviar();
  assert.strictEqual(r.nuevos.length, 1);
  assert.strictEqual(r.nuevos[0].titulo, "Alerta Sanitaria sobre : CREMA X");
});

prueba("inicializarHoja crea pestanas y es idempotente", () => {
  const { g, hojas } = crearEntorno();
  g.inicializarHoja();
  g.inicializarHoja();
  assert.deepStrictEqual(Object.keys(hojas).sort(),
    ["Config_Fuentes", "Historico", "Listado_Terapeutico", "Log", "Reglas", "Vigilancia"]);
  assert.strictEqual(hojas.Reglas.d.length, 1 + g.PRECARGA.Reglas.length);
  assert.deepStrictEqual(hojas.Reglas.d[0], ["termino", "nivel", "motivo"]);
  assert.strictEqual(hojas.Config_Fuentes.d[2][1], "https://www.invima.gov.co/alertas-sanitarias?direccion=dd");
  assert.strictEqual(hojas.Historico.d[0].length, 16);
});

function entornoListo(opciones) {
  const e = crearEntorno(opciones);
  e.g.inicializarHoja();
  // Como en la hoja real: ALI y COS quedan inactivas hasta que el referente las active.
  e.hojas.Config_Fuentes.getRange(4, 3, 2, 1).setValues([["NO"], ["NO"]]);
  e.hojas.Listado_Terapeutico.getRange(2, 1, 1, 5).setValues([["DM-0457", "Cemento óseo con gentamicina", "Gentamicina", "Palacos", "DM"]]);
  e.hojas.Vigilancia.getRange(2, 1, 1, 1).setValues([["Butilbromuro de hioscina"]]);
  return e;
}

prueba("clasificacion ALTA / MEDIA / BAJA", () => {
  const { g, hojas } = entornoListo();
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const med = g.parsearListado_(ENVOLTURA(MED_FILAS), "MED").map((it) => g.clasificar_(it, reglas));
  const dm = g.parsearListado_(ENVOLTURA(DM_FILAS), "DM").map((it) => g.clasificar_(it, reglas));
  assert.strictEqual(med[0].nivel, "BAJA");                 // sin coincidencias
  assert.strictEqual(med[1].nivel, "ALTA");                 // BUSCAPINA: marca de uso frecuente
  assert.strictEqual(med[1].coincidencia, "Uso frecuente: BUSCAPINA");
  assert.strictEqual(med[2].nivel, "BAJA");                 // CBD manda sobre "falsificado"
  assert.strictEqual(dm[0].nivel, "MEDIA");                 // informe de seguridad
  assert.strictEqual(dm[1].nivel, "ALTA");                  // Listado Terapeutico: gentamicina / Palacos
  assert.strictEqual(dm[1].coincidencia, "GENTAMICINA: Cemento óseo con gentamicina (DM-0457)");
  assert.strictEqual(dm[2].nivel, "BAJA");
  // El Listado Terapeutico DM no aplica a MED.
  const medGenta = g.clasificar_(g.parsearListado_(ENVOLTURA([filaMed("Alerta sanitaria sobre: GENTAMICINA 80 MG", "Alerta%20No_1-2026.pdf")]), "MED")[0], reglas);
  assert.strictEqual(medGenta.nivel, "BAJA");
});

prueba("combinaciones y plurales en Listado Terapeutico/Vigilancia", () => {
  const { g, hojas } = entornoListo();
  hojas.Listado_Terapeutico.getRange(3, 1, 2, 5).setValues([
    ["MED-0101", "PIPERACILINA/TAZOBACTAM 4.5G AMP", "PIPERACILINA/TAZOBACTAM", "", "MED"],
    ["DM-0200", "CATETER VENOSO CENTRAL 7FR", "CATETER", "", "DM"]
  ]);
  hojas.Vigilancia.getRange(3, 1, 1, 1).setValues([["TRIMETOPRIMA+SULFAMETOXAZOL"]]);
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const med = (titulo) => g.clasificar_(g.parsearListado_(ENVOLTURA([filaMed(titulo, "Alerta%20No_1-2026.pdf")]), "MED")[0], reglas);
  const dm = (titulo) => g.clasificar_(g.parsearListado_(ENVOLTURA([filaDm(titulo, "X", "Alerta sanitaria",
    "ALERTAS%20SANITARIAS/Dispositivos_Medicos/2026/Octubre", "Alerta%20No_%20%2399-2026.pdf")]), "DM")[0], reglas);
  assert.strictEqual(med("Alerta sanitaria sobre: TAZOBACTAM genérico").coincidencia, "TAZOBACTAM: PIPERACILINA/TAZOBACTAM 4.5G AMP (MED-0101)");
  assert.strictEqual(med("Alerta sanitaria sobre: SULFAMETOXAZOL suspensión").coincidencia, "Vigilancia: TRIMETOPRIMA+SULFAMETOXAZOL");
  assert.strictEqual(dm("Alerta sanitaria sobre: Catéteres venosos centrales").nivel, "ALTA");
  assert.strictEqual(med("Alerta sanitaria sobre: LOTES FALSIFICADOS").nivel, "MEDIA");
  assert.strictEqual(med("Alerta sanitaria sobre: SUPLEMENTOS DIETARIOS").nivel, "BAJA");
});

prueba("lote dispensado -> ALTA; laboratorio proveedor -> MEDIA", () => {
  const { g, hojas } = entornoListo();
  hojas.Listado_Terapeutico.getRange(3, 1, 2, 8).setValues([
    ["UT213718-2", "HIOSCINA N-B.BROMURO 10MG TAB", "HIOSCINA", "", "MED", "ANTIESPASMODICO", "F0537A; G00319A", "BOEHRINGER"],
    ["UT19959771-5", "ACETAMINOFEN TAB 500MG", "ACETAMINOFEN", "", "MED", "ANALGESICOS", "1234", "GENFAR; GLOBAL"]
  ]);
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const med = (titulo) => g.clasificar_(g.parsearListado_(ENVOLTURA([filaMed(titulo, "Alerta%20No_1-2026.pdf")]), "MED")[0], reglas);
  const porLote = med("Alerta sanitaria sobre: FALSIFICACIÓN DEL PRODUCTO BUSCAPINA® COMPOSITUM LOTE F0537A");
  assert.strictEqual(porLote.nivel, "ALTA");
  assert.ok(porLote.coincidencia.startsWith("Lote F0537A dispensado en HDV: HIOSCINA N-B.BROMURO 10MG TAB (UT213718-2)"));
  const porLab = med("Alerta sanitaria sobre: producto fraudulento con etiqueta Genfar");
  assert.strictEqual(porLab.nivel, "MEDIA");
  assert.strictEqual(porLab.coincidencia, "Laboratorio proveedor HDV: GENFAR");
  assert.strictEqual(med("Alerta sanitaria sobre: GLOBAL NUTRITION capsulas").nivel, "BAJA", "laboratorio generico ignorado");
  assert.strictEqual(med("Alerta sanitaria sobre: producto 1234").nivel, "BAJA", "lote corto ignorado");
});

prueba("coincidencias agrupadas por termino, el mas especifico primero", () => {
  const { g, hojas } = entornoListo();
  hojas.Listado_Terapeutico.getRange(3, 1, 3, 5).setValues([
    ["DM-1", "TUBO ENDOTRAQUEAL Nº 7.0", "ENDOTRAQUEAL", "", "DM"],
    ["DM-2", "TUBO ENDOTRAQUEAL Nº 7.5", "ENDOTRAQUEAL", "", "DM"],
    ["DM-3", "BALON PERIFERICO", "BALON", "", "DM"]
  ]);
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const it = g.clasificar_(g.parsearListado_(ENVOLTURA([filaDm("Alerta sanitaria sobre: Tubo endotraqueal con y sin balón SunMed", "X",
    "Alerta sanitaria", "ALERTAS%20SANITARIAS/Dispositivos_Medicos/2026/Octubre", "Alerta%20No_%20%23311-2026.pdf")]), "DM")[0], reglas);
  assert.strictEqual(it.coincidencia, "ENDOTRAQUEAL: TUBO ENDOTRAQUEAL Nº 7.0 (DM-1) y 1 más; BALON: BALON PERIFERICO (DM-3)");
  const micro = g.laboratoriosDe_("MICRO; MEDTRONIC");
  assert.strictEqual(JSON.stringify(micro), JSON.stringify(["MEDTRONIC"]));
});

prueba("marca comercial de uso frecuente -> ALTA con su motivo", () => {
  const { g } = entornoListo();
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const it = g.clasificar_(g.parsearListado_(ENVOLTURA([filaMed("Alerta sanitaria sobre: OZEMPIC® falsificado", "Alerta%20No_2-2026.pdf")]), "MED")[0], reglas);
  assert.strictEqual(it.nivel, "ALTA");
  assert.strictEqual(it.coincidencia, "Uso frecuente: OZEMPIC");
});

prueba("formato del mensaje inmediato", () => {
  const { g } = entornoListo();
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const it = g.clasificar_(g.parsearListado_(ENVOLTURA(DM_FILAS), "DM")[1], reglas);
  const lineas = g.formatearMensaje_(it).split("\n");
  assert.deepStrictEqual(lineas.slice(0, 5), [
    "[INVIMA-DM] \u{1F534} *PRIORIDAD ALTA* · \u{1FA7A} Dispositivo médico",
    "*Informe de seguridad No. 149-2026*",
    "",
    "\u{1F4CC} Cementos óseos con gentamicina Heraeus® Cemento óseo radiopaco a base de PMMA PALACOS® R+G...",
    "\u{1F4C5} Publicada: 2026-10-19"
  ]);
  assert.strictEqual(lineas[5], "\u{1F194} ID INVIMA: DI2609-00541 · Estado: SEGUIMIENTO");
  assert.strictEqual(lineas[7], "\u{1F3E5} *Coincidencia HDV:*");
  assert.strictEqual(lineas[8], "• GENTAMICINA: Cemento óseo con gentamicina (DM-0457)");
  assert.ok(lineas.some((l) => l.startsWith("\u{1F4C4} PDF: https://app.invima.gov.co/alertas/ckfinder/")));
  assert.strictEqual(lineas.slice(-2).join("\n"), "_Bot Alertas INVIMA · Ecosistema de Vigilancia Digital del Servicio Farmacéutico HDV_\n_Desarrollado por el QF Juan Pablo Saavedra_");
});

prueba("fecha del listado no confiable -> se muestra la fecha de deteccion", () => {
  const { g } = entornoListo();
  const reglas = g.cargarReglas_(g.abrirHoja_());
  const it = g.clasificar_(g.parsearListado_(ENVOLTURA(MED_FILAS), "MED")[0], reglas); // fecha 2016-10-14, alerta 2026
  it.fechaDeteccion = new Date(2026, 9, 20);
  assert.ok(g.formatearMensaje_(it).includes("\u{1F4C5} Detectada: 2026-10-20"));
});

prueba("probarSinEnviar no envia ni escribe en Historico", () => {
  const { g, hojas, enviados, registro } = entornoListo();
  g.probarSinEnviar();
  assert.strictEqual(enviados.length, 0);
  assert.strictEqual(hojas.Historico.d.length, 1);
  assert.ok(registro.some((l) => l.includes("[SIMULADO - no enviado]") && l.includes("[INVIMA-MED]")));
  assert.ok(registro.some((l) => l.includes("Resumen semanal")));
  assert.ok(hojas.Log.filas().every((f) => String(f.estado).startsWith("PRUEBA/")));
});

prueba("cargaInicial pobla Historico sin enviar; revisarAlertas no repite", () => {
  const { g, hojas, enviados, urlsInvima } = entornoListo();
  g.cargaInicial();
  assert.strictEqual(enviados.length, 0);
  assert.strictEqual(hojas.Historico.d.length, 7);
  assert.ok(hojas.Historico.filas().every((f) => f.enviado === "CARGA_INICIAL"));
  assert.ok(urlsInvima.some((u) => u.includes("/alertas-sanitarias/page/2?")));
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 0);
  assert.strictEqual(hojas.Historico.d.length, 7);
});

prueba("revisarAlertas envia todas las alertas nuevas (ALTA primero, tambien BAJA) y no repite", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  g.cargaInicial();
  estado.html.MED = ENVOLTURA(MED_FILAS.concat([
    filaMed("Alerta sanitaria sobre: PRODUCTO HOMEOPÁTICO X", "Alerta%20No_332-2026.pdf"),
    filaMed("Alerta sanitaria sobre: RETIRO DE LOTE BUTILBROMURO DE HIOSCINA", "Alerta%20No_331-2026.pdf")
  ]));
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 2, "ALTA y BAJA, sin encuesta (desactivada en este entorno)");
  assert.ok(enviados.every((e) => e.cuerpo.chatId === "120363412506101174@g.us"));
  assert.ok(enviados[0].cuerpo.message.startsWith("[INVIMA-MED] \u{1F534} *PRIORIDAD ALTA* · \u{1F48A} Medicamento\n*Alerta sanitaria No. 331-2026*"), "ALTA primero");
  assert.ok(enviados[0].cuerpo.message.includes("*Coincidencia HDV:*\n• Vigilancia: Butilbromuro de hioscina"));
  assert.ok(enviados[0].cuerpo.message.includes("\u2753 Dudas: QF Juan Pablo Saavedra HDV · https://wa.me/573245844408\n\n_Bot Alertas INVIMA"));
  assert.ok(enviados[1].cuerpo.message.startsWith("[INVIMA-MED] ⚪ *PRIORIDAD BAJA*"));
  assert.ok(enviados[1].cuerpo.message.includes("PRODUCTO HOMEOPÁTICO X"));
  const porClave = Object.fromEntries(hojas.Historico.filas().map((f) => [f.clave, f]));
  assert.strictEqual(porClave["MED:AS:331-2026"].enviado, "SI");
  assert.strictEqual(porClave["MED:AS:332-2026"].enviado, "SI");
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 2, "ninguna clave se envia dos veces");
  const resumen = g.resumenSemanal();
  assert.strictEqual(enviados.length, 3);
  assert.ok(resumen.includes("\u{1F48A} Medicamento: \u{1F534} 1 · \u{1F7E0} 0 · ⚪ 1"));
  assert.ok(!resumen.includes("PRODUCTO HOMEOPÁTICO X"), "la BAJA ya enviada no se repite en el resumen");
  assert.ok(!resumen.includes("ETHIOPIAN"), "la carga inicial no entra al resumen");
});

prueba("encuesta solo despues de ALTA y MEDIA, no de BAJA", () => {
  const { g, enviados, estado } = entornoListo({ encuesta: true });
  g.cargaInicial();
  estado.html.MED = ENVOLTURA(MED_FILAS.concat([filaMed("Alerta sanitaria sobre: PRODUCTO HOMEOPÁTICO X", "Alerta%20No_332-2026.pdf"),
    filaMed("Alerta sanitaria sobre: RETIRO DE LOTE BUTILBROMURO DE HIOSCINA", "Alerta%20No_331-2026.pdf")]));
  g.revisarAlertas();
  assert.strictEqual(JSON.stringify(enviados.map((e) => e.url.split("/")[4])), JSON.stringify(["sendMessage", "sendPoll", "sendMessage"]));
});

prueba("resumen semanal sin novedades nombra alertas sanitarias e informes de seguridad", () => {
  const { g } = entornoListo();
  const r = g.resumenSemanal();
  assert.ok(r.startsWith("[INVIMA] \u{1F4CA} *Resumen semanal de alertas e informes de seguridad INVIMA*\n"));
  assert.ok(r.includes("\u2705 *Sin alertas sanitarias ni informes de seguridad nuevos reportados por el INVIMA*"));
  assert.ok(r.includes("\nListados monitoreados: medicamentos y productos biológicos; dispositivos médicos y otras tecnologías.\n"));
  assert.ok(!r.includes("Sin requerimientos de verificación"));
  assert.ok(r.includes("_Vigilancia activa: revisiones diarias a las 6:00, 10:00, 14:00, 18:00._"));
  assert.ok(r.endsWith("_Bot Alertas INVIMA · Ecosistema de Vigilancia Digital del Servicio Farmacéutico HDV_\n_Desarrollado por el QF Juan Pablo Saavedra_"));
});

prueba("aviso tecnico lleva la firma del ecosistema", () => {
  const { g, enviados, estado } = entornoListo();
  estado.html.MED = "<html>mantenimiento</html>";
  g.revisarAlertas();
  assert.ok(enviados[0].cuerpo.message.endsWith("_Bot Alertas INVIMA · Ecosistema de Vigilancia Digital del Servicio Farmacéutico HDV_\n_Desarrollado por el QF Juan Pablo Saavedra_"));
});

prueba("ENVIAR_BAJA = false: BAJA queda para el resumen del lunes (comportamiento anterior)", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  g.cargaInicial();
  g.ENVIAR_BAJA = false;
  estado.html.MED = ENVOLTURA(MED_FILAS.concat([filaMed("Alerta sanitaria sobre: PRODUCTO HOMEOPÁTICO X", "Alerta%20No_332-2026.pdf")]));
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 0);
  assert.strictEqual(hojas.Historico.filas().find((f) => f.clave === "MED:AS:332-2026").enviado, "RESUMEN_SEMANAL");
  assert.ok(g.resumenSemanal().includes("PRODUCTO HOMEOPÁTICO X"));
});

prueba("revision sigue a la pagina siguiente solo si toda la pagina es nueva", () => {
  const { g, hojas, urlsInvima, estado } = entornoListo();
  const fila = (n) => filaMed("Alerta sanitaria sobre: PRODUCTO " + n, "Alerta%20No_" + n + "-2026.pdf");
  // 9 alertas publicadas el mismo dia: 8 en la pagina 0 y 1 en la pagina 1; la pagina 2 ya es conocida.
  estado.paginas = { MED: [ENVOLTURA([0, 1, 2, 3, 4, 5, 6, 7].map((k) => fila(900 + k))), ENVOLTURA([fila(908), fila(800)]), ENVOLTURA([fila(700)])], DM: [ENVOLTURA(DM_FILAS)] };
  hojas.Historico.getRange(2, 1, 1, 1).setValues([["MED:AS:800-2026"]]);
  g.revisarAlertas();
  const claves = hojas.Historico.filas().map((f) => f.clave);
  assert.ok(claves.includes("MED:AS:908-2026"), "la novena alerta (pagina 1) no se pierde");
  assert.ok(!urlsInvima.some((u) => u.includes("/page/3?direccion=dm")), "se detiene al encontrar una alerta conocida");
  assert.ok(urlsInvima.some((u) => u.includes("/page/2?direccion=dd")), "DM toda nueva -> revisa la pagina siguiente");
});

prueba("vistaPrevia muestra todas las alertas de la pagina 0 sin enviar ni escribir", () => {
  const { g, hojas, enviados, registro } = entornoListo();
  g.cargaInicial();
  const filasAntes = hojas.Historico.d.length;
  g.vistaPrevia();
  assert.strictEqual(enviados.length, 0);
  assert.strictEqual(hojas.Historico.d.length, filasAntes);
  assert.ok(registro.some((l) => l.includes("[VISTA PREVIA - DM:IS:149-2026 - ya registrada en Historico]") && l.includes("[INVIMA-DM]")));
});

prueba("mas de 10 alertas inmediatas -> un solo mensaje agrupado", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  const filas = [];
  for (let n = 400; n < 412; n++) filas.push(filaMed("Alerta sanitaria sobre: RETIRO PRODUCTO " + n, "Alerta%20No_" + n + "-2026.pdf"));
  estado.html.MED = ENVOLTURA(filas);
  estado.html.DM = ENVOLTURA([]);
  g.revisarAlertas();
  // 1 agrupado + 1 aviso tecnico por DM vacio
  assert.strictEqual(enviados.length, 2);
  assert.ok(enviados[0].cuerpo.message.startsWith("[INVIMA] \u{1F50E} *12 alertas nuevas*"));
  assert.ok(hojas.Historico.filas().every((f) => f.enviado === "SI"));
});

prueba("sin encuestas: 10 alertas van individuales, 11 se agrupan", () => {
  const alta = (n) => filaMed("Alerta sanitaria sobre: OZEMPIC lote " + n, "Alerta%20No_" + n + "-2026.pdf");
  const e1 = entornoListo();
  e1.estado.html.DM = ENVOLTURA([]);
  e1.estado.paginas = { MED: [ENVOLTURA([600, 601, 602, 603, 604, 605, 606, 607].map(alta)), ENVOLTURA([608, 609].map(alta))], DM: [ENVOLTURA([])] };
  e1.g.revisarAlertas();
  const envios1 = e1.enviados.filter((e) => !String(e.cuerpo.message || "").includes("No se pudo leer"));
  assert.strictEqual(envios1.length, 10);
  assert.ok(envios1.every((e) => e.url.split("/")[4] === "sendMessage"));
  const e2 = entornoListo();
  e2.estado.paginas = { MED: [ENVOLTURA([610, 611, 612, 613, 614, 615, 616, 617].map(alta)), ENVOLTURA([618, 619, 620].map(alta))], DM: [ENVOLTURA([])] };
  e2.g.revisarAlertas();
  const envios2 = e2.enviados.filter((e) => !String(e.cuerpo.message || "").includes("No se pudo leer"));
  assert.strictEqual(envios2.length, 1);
  assert.ok(envios2[0].cuerpo.message.includes("*11 alertas nuevas*"));
  assert.ok(!e2.enviados.some((e) => e.url.includes("sendPoll")));
});

prueba("enviarPruebaAlerta envia 1 mensaje marcado como prueba, sin encuesta ni escritura", () => {
  const { g, hojas, enviados } = entornoListo();
  g.enviarPruebaAlerta();
  assert.deepStrictEqual(enviados.map((e) => e.url.split("/")[4]), ["sendMessage"]);
  assert.ok(enviados[0].cuerpo.message.startsWith("\u{1F9EA} *MENSAJE DE PRUEBA*"));
  assert.ok(enviados[0].cuerpo.message.includes("*PRIORIDAD ALTA*"));
  assert.ok(enviados.every((e) => e.cuerpo.chatId === "120363412506101174@g.us"));
  assert.strictEqual(hojas.Historico.d.length, 1);
});

const URL_PDF_MED = (archivo) => "https://app.invima.gov.co/alertas/ckfinder/userfiles/files/ALERTAS%20SANITARIAS/medicamentos_pbiologicos/2026/OCTUBRE/" + archivo;

function pdfConFoto() {
  const ascii = (t) => Array.from(Buffer.from(t, "latin1"));
  const jpeg = (n) => [0xFF, 0xD8].concat(Array(n).fill(0x41), [0xFF, 0xD9]);
  return ascii("%PDF-1.4\n<< /Subtype /Image /Width 1649 /Height 195 /Filter /DCTDecode >>\nstream\n").concat(jpeg(37000),
    ascii("\nendstream\n<< /Subtype /Image /Width 612 /Height 666 /Filter /DCTDecode >>\nstream\n"), jpeg(59000), ascii("\nendstream\n"));
}

function entornoConAlertaMed(opciones) {
  const e = entornoListo(opciones);
  e.g.cargaInicial();
  e.estado.html.MED = ENVOLTURA(MED_FILAS.concat([
    filaMed("Alerta sanitaria sobre: RETIRO DE LOTE BUTILBROMURO DE HIOSCINA", "Alerta%20No_331-2026.pdf")
  ]));
  e.estado.html.DM = ENVOLTURA(DM_FILAS.concat([
    filaDm("Alerta sanitaria sobre: Cemento óseo PALACOS lote X", "DI2610-00002", "Alerta sanitaria",
      "ALERTAS%20SANITARIAS/Dispositivos_Medicos/2026/Octubre", "Alerta%20No_%20%23356-2026.pdf")
  ]));
  e.estado.pdfs = { [URL_PDF_MED("Alerta%20No_331-2026.pdf")]: pdfConFoto() };
  return e;
}

prueba("alerta MED con foto: sendFileByUpload al servidor de medios con el texto al pie; DM como texto", () => {
  const { g, hojas, enviados, urlsInvima } = entornoConAlertaMed();
  g.revisarAlertas();
  const metodos = enviados.map((e) => e.url.split("/")[4]);
  assert.strictEqual(JSON.stringify(metodos), JSON.stringify(["sendFileByUpload", "sendMessage"]));
  const foto = enviados[0];
  assert.ok(foto.url.startsWith("https://7107.media.greenapi.com/waInstance710722693364/sendFileByUpload/"));
  assert.strictEqual(foto.contentType, undefined, "multipart, no JSON");
  assert.strictEqual(foto.cuerpo.chatId, "120363412506101174@g.us");
  assert.ok(foto.cuerpo.caption.startsWith("[INVIMA-MED] \u{1F534} *PRIORIDAD ALTA*"));
  assert.strictEqual(foto.cuerpo.fileName, "MED_AS_331-2026.jpg");
  assert.strictEqual(foto.cuerpo.file.tipo, "image/jpeg");
  assert.strictEqual(foto.cuerpo.file.bytes.length, 59004, "la foto, no el banner");
  assert.ok(enviados[1].cuerpo.message.startsWith("[INVIMA-DM]"));
  assert.ok(!urlsInvima.some((u) => u.includes("Dispositivos_Medicos") && u.endsWith(".pdf")), "no descarga PDF de DM");
  const porClave = Object.fromEntries(hojas.Historico.filas().map((f) => [f.clave, f]));
  assert.strictEqual(porClave["MED:AS:331-2026"].enviado, "SI");
});

prueba("servidor de medios inexistente (DNS): reintenta la foto en el servidor de la API; GA_MEDIA_URL manda", () => {
  let e = entornoConAlertaMed();
  e.estado.hostsCaidos = ["7107.media.greenapi.com"];
  e.g.revisarAlertas();
  assert.strictEqual(e.enviados[0].url.split("/")[2], "7107.api.greenapi.com");
  assert.strictEqual(e.enviados[0].url.split("/")[4], "sendFileByUpload");
  assert.ok(e.registro.some((l) => l.includes("Error de DNS") && !l.includes(TOKEN)));
  e = entornoConAlertaMed({ props: { GA_MEDIA_URL: "https://7107.media.green-api.com/" } });
  e.g.revisarAlertas();
  assert.ok(e.enviados[0].url.startsWith("https://7107.media.green-api.com/waInstance710722693364/sendFileByUpload/"));
  e = entornoConAlertaMed();
  e.estado.hostsCaidos = ["greenapi.com"];       // ningun servidor responde: texto tampoco sale, sin excepcion
  e.g.revisarAlertas();
  assert.strictEqual(e.enviados.length, 0);
  const porClave = Object.fromEntries(e.hojas.Historico.filas().map((f) => [f.clave, f]));
  assert.strictEqual(porClave["MED:AS:331-2026"].enviado, "ERROR");
});

prueba("buscarIdGrupo encuentra el chatId del grupo donde escribieron ID BOT, solo lectura", () => {
  const { g, enviados, registro, estado } = crearEntorno();
  estado.entrantes = [
    { chatId: "120363000000000001@g.us", senderName: "Juan", textMessage: "id bot" },
    { chatId: "120363000000000002@g.us", senderName: "Ana", textMessage: "Buenos días, paciente cama 4" },
    { chatId: "573000000000@c.us", senderName: "Pedro", textMessage: "ID BOT" },
    { chatId: "120363000000000003@g.us", senderName: "Luis", extendedTextMessage: { text: "ID BOT" } }
  ];
  const grupos = g.buscarIdGrupo();
  assert.strictEqual(JSON.stringify(grupos), JSON.stringify(["120363000000000001@g.us", "120363000000000003@g.us"]));
  assert.ok(enviados.every((e) => e.lectura), "no envia nada");
  assert.ok(enviados[0].url.includes("/lastIncomingMessages/") && enviados[0].url.includes("minutes=1440"));
  assert.ok(!registro.some((l) => l.includes("cama 4")), "no registra otros mensajes");
  assert.ok(!registro.some((l) => l.includes(TOKEN)));
});

prueba("si la foto falla se envia como texto; sin PDF tambien; 466 en la foto no reintenta", () => {
  let e = entornoConAlertaMed();
  e.estado.falloFoto = 500;
  e.g.revisarAlertas();
  assert.strictEqual(JSON.stringify(e.enviados.slice(0, 3).map((x) => x.url.split("/")[4])),
    JSON.stringify(["sendFileByUpload", "sendMessage", "sendMessage"]));
  assert.ok(e.enviados[1].cuerpo.message.startsWith("[INVIMA-MED]"));

  e = entornoConAlertaMed();
  e.estado.pdfs = {};                              // PDF no disponible (404)
  e.g.revisarAlertas();
  assert.strictEqual(e.enviados[0].url.split("/")[4], "sendMessage");

  e = entornoConAlertaMed();
  e.estado.falloFoto = 466;
  e.g.revisarAlertas();
  assert.strictEqual(e.enviados.length, 1, "tras el 466 no hay texto de respaldo ni mas envios");
  const porClave = Object.fromEntries(e.hojas.Historico.filas().map((f) => [f.clave, f]));
  assert.strictEqual(porClave["MED:AS:331-2026"].enviado, "NO_ENVIADO_466");
});

prueba("probarSinEnviar muestra la foto simulada sin enviar", () => {
  const { g, enviados, registro } = entornoConAlertaMed();
  g.probarSinEnviar();
  assert.strictEqual(enviados.length, 0);
  assert.ok(registro.some((l) => l.startsWith("[SIMULADO - foto 58 KB 612x666, texto al pie]") && l.includes("331-2026")));
});

prueba("texto mas largo que el pie permitido -> solo texto, sin descargar el PDF", () => {
  const { g, enviados, urlsInvima } = entornoConAlertaMed();
  g.MAX_CARACTERES_PIE = 10;
  g.revisarAlertas();
  assert.strictEqual(enviados[0].url.split("/")[4], "sendMessage");
  assert.ok(!urlsInvima.some((u) => u.endsWith("No_331-2026.pdf")));
});

prueba("encuesta de socializacion despues de cada alerta individual (foto o texto), no en el agrupado", () => {
  const e = entornoConAlertaMed({ encuesta: true });
  e.g.revisarAlertas();
  const metodos = e.enviados.map((x) => x.url.split("/")[4]);
  assert.strictEqual(JSON.stringify(metodos), JSON.stringify(["sendFileByUpload", "sendPoll", "sendMessage", "sendPoll"]));
  const poll = e.enviados[1].cuerpo;
  assert.strictEqual(poll.chatId, "120363412506101174@g.us");
  assert.strictEqual(poll.message, "\u{1F534} Alerta sanitaria No. 331-2026 (MED): ¿recibió y socializó esta información en su servicio?");
  assert.strictEqual(poll.options[0].optionName, "\u2705 Sí");
  assert.strictEqual(poll.options[1].optionName, "\u274C No");
  assert.strictEqual(poll.options.length, 2);
  assert.strictEqual(poll.multipleAnswers, false);
  const alta = (n) => filaMed("Alerta sanitaria sobre: OZEMPIC lote " + n, "Alerta%20No_" + n + "-2026.pdf");
  const e2 = entornoListo({ encuesta: true });
  e2.estado.paginas = { MED: [ENVOLTURA([710, 711, 712, 713, 714, 715, 716, 717].map(alta)), ENVOLTURA([718, 719, 720].map(alta))], DM: [ENVOLTURA([])] };
  e2.g.revisarAlertas();
  assert.ok(!e2.enviados.some((x) => x.url.includes("sendPoll")), "11 alertas: mensaje agrupado sin encuesta");
});

prueba("enviarPruebaAlerta con encuesta: mensaje de prueba + encuesta", () => {
  const { g, enviados } = entornoListo({ encuesta: true });
  g.enviarPruebaAlerta();
  assert.deepStrictEqual(enviados.map((e) => e.url.split("/")[4]), ["sendMessage", "sendPoll"]);
});

prueba("si el texto con recomendacion no cabe como pie de foto, va la foto con la version corta", () => {
  const e = entornoConAlertaMed();
  e.estado.detalles = { "https://www.invima.gov.co/alertas-sanitarias/retiro": DETALLE_DIALUX.replace(/En el evento[^<]*/, "X".repeat(340)) };
  e.estado.paginas = { MED: [PAGINA_NUEVA([tarjeta({ numero: "331–2026", titulo: "RETIRO DE LOTE BUTILBROMURO DE HIOSCINA", slug: "retiro",
    fecha: "21-10-2026", clase: "Retiro de producto", pdfId: "12950" })])], DM: [ENVOLTURA([])] };
  e.estado.pdfs = { "https://www.invima.gov.co/alertas-sanitarias/12950/pdf": pdfConFoto() };
  e.g.MAX_CARACTERES_PIE = 900;
  e.g.MOSTRAR_RECOMENDACION_IPS = true;
  e.g.revisarAlertas();
  const foto = e.enviados.find((x) => x.url.includes("sendFileByUpload"));
  assert.ok(foto, "se envio con foto");
  assert.ok(!foto.cuerpo.caption.includes("Recomendación INVIMA"), "sin recomendacion para caber");
  assert.ok(foto.cuerpo.caption.includes("Registro sanitario"), "la ficha si va");
});

prueba("extraerJpegsPdf_ encuentra los JPEG incrustados y elige la foto mas grande", () => {
  const { g } = crearEntorno();
  const jpeg = (n) => [0xFF, 0xD8, 0xFF, 0xE0].concat(Array(n).fill(0x41), [0xFF, 0xD9]);
  const ascii = (t) => Array.from(Buffer.from(t, "latin1"));
  const objeto = (dic, datos) => ascii(dic + "\nstream\r\n").concat(datos, ascii("\r\nendstream\nendobj\n"));
  const pdf = ascii("%PDF-1.4\n")
    .concat(objeto("5 0 obj << /Type /XObject /Subtype /Image /Width 120 /Height 40 /Filter /DCTDecode /Length 9 >>", jpeg(3000)))
    .concat(objeto("6 0 obj << /Type /XObject /Subtype /Image /Width 800 /Height 600 /Filter [/DCTDecode] /Length 9 >>", jpeg(60000)))
    .concat(objeto("7 0 obj << /Type /XObject /Subtype /Image /Width 50 /Height 50 /Filter /FlateDecode /Length 3 >>", [1, 2, 3]));
  const r = g.extraerJpegsPdf_(pdf.map((b) => (b > 127 ? b - 256 : b))); // bytes con signo, como en Apps Script
  assert.strictEqual(r.totalImagenes, 3);
  assert.strictEqual(r.jpegs.length, 2);
  const foto = g.elegirFoto_(r.jpegs);
  assert.strictEqual(foto.ancho, 800);
  assert.strictEqual(foto.alto, 600);
  assert.strictEqual(foto.bytes.length, 60006);
  assert.strictEqual(foto.bytes[0] & 255, 0xFF);
  assert.strictEqual(foto.bytes[foto.bytes.length - 1] & 255, 0xD9);
  assert.strictEqual(g.elegirFoto_([r.jpegs[0]]), null, "el logo de 3 KB no se elige");
  assert.strictEqual(r.otras.length, 1);
  assert.ok(r.otras[0].startsWith("50x50 FlateDecode"), r.otras[0]);
});

prueba("fotosCandidatas_ descarta la franja de encabezado aunque sea grande (caso BUSCAPINA 329-2026)", () => {
  const { g } = crearEntorno();
  const j = (kb, ancho, alto) => ({ kb, ancho, alto, bytes: new Array(kb * 1024) });
  const fotos = g.fotosCandidatas_([j(36, 1649, 195), j(51, 900, 502), j(58, 612, 666), j(4, 200, 200)]);
  assert.strictEqual(JSON.stringify(fotos.map((f) => f.ancho)), JSON.stringify([612, 900]));
  assert.strictEqual(g.elegirFoto_([j(80, 1649, 195)]), null, "una franja sola no es foto");
  assert.strictEqual(g.elegirFoto_([j(33, 885, 282), j(36, 1649, 195)]).ancho, 885, "foto apaisada de 319-2026");
});

prueba("diagnosticarImagenesPdf recorre Historico por lotes y continua donde quedo", () => {
  const { g, hojas, estado, registro } = entornoListo();
  const ascii = (t) => Array.from(Buffer.from(t, "latin1"));
  const jpeg = [0xFF, 0xD8].concat(Array(20000).fill(0x41), [0xFF, 0xD9]);
  const pdfFoto = ascii("%PDF-1.4\n<< /Subtype /Image /Width 600 /Height 500 /Filter /DCTDecode >>\nstream\n")
    .concat(jpeg, ascii("\nendstream\n<< /Subtype /Image /Width 90 /Height 40 /Filter /FlateDecode >>\nstream\nxx\nendstream"));
  estado.pdfs = { "https://x/a.pdf": pdfFoto, "https://x/b.pdf": ascii("%PDF-1.4\n") };
  hojas.Historico.getRange(5, 1, 1, 12).setValues([["MED:AS:308-2026", "MED", "308", "2026",
    "Alerta sanitaria sobre: Productos fraudulentos promocionados como medicamentos a través de comercio electrónico - Parte 6",
    "Alerta sanitaria", "2026-09-18", "", "", "BAJA", "", "RESUMEN_SEMANAL"]]);
  hojas.Historico.getRange(2, 1, 3, 12).setValues([
    ["MED:AS:1-2026", "MED", "1", "2026", "Alerta sanitaria sobre: A", "Alerta sanitaria", "", "https://x/a.pdf", "", "ALTA", "", "SI"],
    ["DM:AS:2-2026", "DM", "2", "2026", "Alerta sanitaria sobre: B", "Alerta sanitaria", "", "https://x/b.pdf", "", "BAJA", "", "SI"],
    ["DM:IS:3-2026", "DM", "3", "2026", "Informe de seguridad sobre: C", "Informe de seguridad", "", "https://x/c.pdf", "", "MEDIA", "", "SI"]
  ]);
  g.MAX_MS_DIAGNOSTICO = -1;                      // sin tiempo: no procesa nada y avisa
  g.diagnosticarImagenesPdf();
  assert.ok(registro.some((l) => l.includes("faltan 3")));
  g.MAX_MS_DIAGNOSTICO = 270000;
  g.diagnosticarImagenesPdf();
  const filas = hojas.Diag_Imagenes.filas();
  assert.strictEqual(JSON.stringify(filas.map((f) => f.clave)), JSON.stringify(["MED:AS:1-2026", "DM:AS:2-2026", "DM:IS:3-2026"]));
  assert.strictEqual(filas[0].jpeg_elegido, "20 KB 600x500");
  assert.ok(filas[0].otras_imagenes.startsWith("90x40 FlateDecode"));
  assert.strictEqual(filas[1].jpeg_elegido, "—");
  assert.ok(String(filas[2].jpeg_encontrados).includes("HTTP 404"));
  assert.strictEqual(hojas.Diag_Imagenes.imagenes.length, 1);
  assert.ok(registro.some((l) => l === "RESUMEN MED:AS: 1 de 1 con foto"));
  g.diagnosticarImagenesPdf();                    // nada pendiente: no repite
  assert.strictEqual(hojas.Diag_Imagenes.filas().length, 3);
  g.reiniciarDiagnosticoImagenes();
  assert.strictEqual(hojas.Diag_Imagenes.d.length, 1);
  assert.strictEqual(hojas.Diag_Imagenes.imagenes.length, 0);
});

prueba("error 466: se registra, no se reintenta y no se reenvia despues", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  estado.codigoGreen = 466;
  estado.html.MED = ENVOLTURA([
    filaMed("Alerta sanitaria sobre: RETIRO A", "Alerta%20No_500-2026.pdf"),
    filaMed("Alerta sanitaria sobre: RETIRO B", "Alerta%20No_501-2026.pdf")
  ]);
  estado.html.DM = ENVOLTURA([]);
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 1, "tras el 466 no se intenta nada mas");
  assert.ok(hojas.Historico.filas().every((f) => f.enviado === "NO_ENVIADO_466"));
  assert.ok(hojas.Log.filas().some((f) => f.estado === "CUOTA_466"));
  estado.codigoGreen = 200;
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 2, "solo el aviso tecnico, no las alertas");
});

prueba("analisisIndice_ y analisisDetalle_ resumen filtros, formulario, feeds, tarjetas y detalle", () => {
  const { g } = crearEntorno();
  const indice = '<html><head><link rel="alternate" type="application/rss+xml" href="/alertas-sanitarias/feed"/></head><body>' +
    '<form action="/alertas-sanitarias" method="get"><input name="q"/><select name="anio"><option value="">Todos los años</option><option value="2026">2026</option></select></form>' +
    '<a href="/alertas-sanitarias?direccion=da">A</a><a href="/alertas-sanitarias?direccion=dm">M</a><a href="/alertas-sanitarias?tipo=informe">I</a>' +
    '<a href="/alertas-sanitarias?orden=fecha">O</a><span class="inv-lst-conteo"> 6.256 documentos </span>' +
    PAGINA_NUEVA(TARJETAS_MED.concat(TARJETAS_ALI)) + '<a href="/alertas-sanitarias/page/2">2</a></body></html>';
  const li = g.analisisIndice_(indice);
  assert.ok(li[0].includes("da, dm") && li[1].includes("informe"), li.slice(0, 2).join(" / "));
  assert.ok(li[2].includes("orden"), li[2]);
  assert.ok(li[3].includes("GET /alertas-sanitarias campos=q,anio anios=(todos),2026"), li[3]);
  assert.ok(li[4].includes("/alertas-sanitarias/feed"), li[4]);
  assert.ok(li[5].includes("6.256 documentos"), li[5]);
  assert.ok(li[6].includes('"dm":3') && li[6].includes('"da":1'), li[6]);
  const detalle = '<html><body><article class="inv-det"><h1>DIALUX</h1><dl><dt>Número</dt><dd>357-2026</dd><dt>Registro sanitario</dt><dd>Sin registro</dd></dl>' +
    '<img src="/web/image/12938/foto.jpg"/><img src="/invima_alertas_sanitarias/static/src/img/direcciones/medicamentos.png"/>' +
    '<a href="/alertas-sanitarias/12938/pdf">PDF</a></article></body></html>';
  const ld = g.analisisDetalle_(detalle);
  assert.ok(ld[0].includes("h1: DIALUX"), ld[0]);
  assert.ok(ld[1] === "IMAGENES (sin iconos ni logos): /web/image/12938/foto.jpg", ld[1]);
  assert.ok(ld[2].includes("/alertas-sanitarias/12938/pdf"), ld[2]);
  assert.ok(ld[4].includes("Número = 357-2026") && ld[4].includes("Registro sanitario = Sin registro"), ld[4]);
});

prueba("inspeccionHtml_ resume enlaces, scripts, APIs, marcadores y fragmento del sitio nuevo", () => {
  const { g } = crearEntorno();
  const html = '<html><head><title>Alertas sanitarias e informes de seguridad | Invima</title>' +
    '<script src="/assets/app.123.js"></script><script>fetch("https://api.invima.gov.co/v1/alertas?tipo=med")</script></head>' +
    '<body><a href="/alertas/medicamentos">MED</a><a href="/contacto">X</a>' +
    '<div class="card">Alerta sanitaria No. 340-2026 PRODUCTO X <a href="/docs/Alerta%20No_340-2026.pdf">Ver</a></div></body></html>';
  const l = g.inspeccionHtml_(html);
  assert.ok(l[0].includes("/alertas/medicamentos") && l[0].includes("Alerta%20No_340-2026.pdf") && !l[0].includes("/contacto"), l[0]);
  assert.ok(l[1].includes("/assets/app.123.js"), l[1]);
  assert.ok(l[2].includes("https://api.invima.gov.co/v1/alertas?tipo=med"), l[2]);
  assert.ok(l[3].includes("views-row=0") && l[3].includes("Alerta sanitaria=1"), l[3]);
  assert.ok(l[4].includes("PRODUCTO X"), l[4]);
});

prueba("listado ilegible -> un aviso tecnico por dia", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  estado.html.MED = "<html>mantenimiento</html>";
  g.revisarAlertas();
  g.revisarAlertas();
  const avisos = enviados.filter((e) => e.cuerpo.message.startsWith("[INVIMA] ⚠️ No se pudo leer el listado"));
  assert.strictEqual(avisos.length, 1);
  assert.ok(hojas.Log.filas().some((f) => f.fuente === "MED" && f.estado === "ERROR"));
});

prueba("HTTP 200 sin alertas: el Log guarda titulo y texto de la pagina recibida", () => {
  const { g, hojas, estado } = entornoListo();
  estado.html.MED = "<html><head><title>Sitio en mantenimiento | INVIMA</title><style>.x{}</style></head>" +
    "<body><script>var a=1;</script><h1>Estamos realizando labores de mantenimiento</h1></body></html>";
  g.revisarAlertas();
  const fila = hojas.Log.filas().find((f) => f.fuente === "MED" && f.estado === "ERROR");
  assert.ok(fila.error.includes("HTTP 200, 0 items"), fila.error);
  assert.ok(fila.error.includes("titulo: Sitio en mantenimiento | INVIMA"), fila.error);
  assert.ok(fila.error.includes("texto: Sitio en mantenimiento | INVIMA Estamos realizando labores de mantenimiento"), fila.error);
  assert.ok(!fila.error.includes("var a=1"), "sin scripts");
});

prueba("solo se envia a un grupo y el token no aparece en registros", () => {
  const e = entornoListo({ props: { GA_CHAT_ID: "573001234567@c.us" } });
  e.estado.html.MED = ENVOLTURA([filaMed("Alerta sanitaria sobre: RETIRO C", "Alerta%20No_600-2026.pdf")]);
  e.g.revisarAlertas();
  assert.strictEqual(e.enviados.length, 0);
  assert.ok(e.registro.some((l) => l.includes("envio bloqueado")));
  const todo = e.registro.join("\n") + JSON.stringify(Object.values(e.hojas).map((h) => h.d));
  assert.ok(!todo.includes(TOKEN));
});

prueba("instalarDisparadores reemplaza los existentes", () => {
  const { g, borrados, creados } = crearEntorno();
  g.instalarDisparadores();
  assert.strictEqual(borrados.length, 1);
  assert.deepStrictEqual(creados.map((t) => t.handler),
    ["revisarAlertas", "revisarAlertas", "revisarAlertas", "revisarAlertas", "resumenSemanal"]);
  assert.ok(creados[0].partes.includes("atHour(6)") && creados[3].partes.includes("atHour(18)"));
  assert.ok(creados[4].partes.includes("onWeekDay(MONDAY)") && creados[4].partes.includes("atHour(7)"));
  assert.ok(creados.every((t) => t.partes.includes("inTimezone(America/Bogota)")));
});

prueba("probarAcceso y volcarMuestraHtml (solo lectura)", () => {
  const { g, registro, enviados, urlsInvima } = crearEntorno();
  g.probarAcceso();
  g.volcarMuestraHtml();
  assert.ok(urlsInvima.includes("https://www.invima.gov.co/alertas-sanitarias?direccion=dd"));
  assert.ok(registro.some((l) => l.includes("MUESTRA 1") && l.includes("INFORMES")));
  assert.strictEqual(enviados.length, 0);
});

console.log("\nOK: dry run completo, sin llamadas a APIs externas.");
