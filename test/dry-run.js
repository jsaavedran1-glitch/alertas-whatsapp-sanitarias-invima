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
  const hojas = {};
  const props = Object.assign({
    SS_ID: "ss-prueba", GA_API_URL: "https://7107.api.greenapi.com", GA_ID: "710722693364",
    GA_TOKEN: TOKEN, GA_CHAT_ID: "120363412506101174@g.us"
  }, opciones.props || {});
  const triggers = [{ id: "viejo" }];
  const borrados = [];
  const creados = [];
  const estado = {
    html: { MED: ENVOLTURA(MED_FILAS), DM: ENVOLTURA(DM_FILAS) },
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
        if (url.indexOf("greenapi") >= 0) {
          enviados.push({ url, cuerpo: JSON.parse(opts.payload) });
          return { getResponseCode: () => estado.codigoGreen, getContentText: () => '{"idMessage":"X"}' };
        }
        urlsInvima.push(url);
        const fuente = url.indexOf("dispositivos") >= 0 ? "DM" : "MED";
        const pagina = Number((url.match(/page=(\d+)/) || [0, 0])[1]);
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
  return { g: contexto, registro, enviados, urlsInvima, hojas, props, estado, borrados, creados };
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

prueba("parsearListado_ sin items y clave de respaldo por URL", () => {
  const { g } = crearEntorno();
  assert.strictEqual(g.parsearListado_("<html>error</html>", "MED").length, 0);
  const sinNumero = g.parsearListado_(ENVOLTURA([filaMed("Alerta sanitaria sobre: X", "Comunicado.pdf")]), "MED");
  assert.ok(sinNumero[0].clave.startsWith("MED:https://"));
});

prueba("inicializarHoja crea pestanas y es idempotente", () => {
  const { g, hojas } = crearEntorno();
  g.inicializarHoja();
  g.inicializarHoja();
  assert.deepStrictEqual(Object.keys(hojas).sort(),
    ["Config_Fuentes", "Historico", "Listado_Terapeutico", "Log", "Reglas", "Vigilancia"]);
  assert.strictEqual(hojas.Reglas.d.length, 1 + g.PRECARGA.Reglas.length);
  assert.deepStrictEqual(hojas.Reglas.d[0], ["termino", "nivel", "motivo"]);
  assert.strictEqual(hojas.Config_Fuentes.d[2][1], "https://app.invima.gov.co/alertas/dispositivos-medicos-invima");
  assert.strictEqual(hojas.Historico.d[0].length, 12);
});

function entornoListo(opciones) {
  const e = crearEntorno(opciones);
  e.g.inicializarHoja();
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
  assert.strictEqual(lineas[lineas.length - 1], "_Bot Alertas INVIMA · Servicio Farmacéutico HDV_");
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
  assert.ok(urlsInvima.some((u) => u.endsWith("page=1")));
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 0);
  assert.strictEqual(hojas.Historico.d.length, 7);
});

prueba("revisarAlertas envia ALTA/MEDIA al GA_CHAT_ID, BAJA queda para el resumen", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  g.cargaInicial();
  estado.html.MED = ENVOLTURA(MED_FILAS.concat([
    filaMed("Alerta sanitaria sobre: RETIRO DE LOTE BUTILBROMURO DE HIOSCINA", "Alerta%20No_331-2026.pdf"),
    filaMed("Alerta sanitaria sobre: PRODUCTO HOMEOPÁTICO X", "Alerta%20No_332-2026.pdf")
  ]));
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 2, "alerta ALTA + su encuesta");
  assert.strictEqual(enviados[0].cuerpo.chatId, "120363412506101174@g.us");
  assert.ok(enviados[1].url.includes("/sendPoll/"));
  assert.strictEqual(enviados[1].cuerpo.chatId, "120363412506101174@g.us");
  assert.ok(enviados[1].cuerpo.message.includes("Alerta sanitaria No. 331-2026 (MED): ¿aplica al HDV?"));
  assert.strictEqual(enviados[1].cuerpo.options.length, 3);
  assert.strictEqual(enviados[1].cuerpo.multipleAnswers, false);
  assert.ok(enviados[0].cuerpo.message.startsWith("[INVIMA-MED] \u{1F534} *PRIORIDAD ALTA* · \u{1F48A} Medicamento\n*Alerta sanitaria No. 331-2026*"));
  assert.ok(enviados[0].cuerpo.message.includes("*Coincidencia HDV:*\n• Vigilancia: Butilbromuro de hioscina"));
  const porClave = Object.fromEntries(hojas.Historico.filas().map((f) => [f.clave, f]));
  assert.strictEqual(porClave["MED:AS:331-2026"].enviado, "SI");
  assert.strictEqual(porClave["MED:AS:332-2026"].enviado, "RESUMEN_SEMANAL");
  g.revisarAlertas();
  assert.strictEqual(enviados.length, 2, "ninguna clave se envia dos veces");
  const resumen = g.resumenSemanal();
  assert.strictEqual(enviados.length, 3);
  assert.ok(resumen.includes("\u{1F48A} Medicamento: \u{1F534} 1 · \u{1F7E0} 0 · ⚪ 1"));
  assert.ok(resumen.includes("PRODUCTO HOMEOPÁTICO X"));
  assert.ok(!resumen.includes("ETHIOPIAN"), "la carga inicial no entra al resumen");
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
  assert.ok(!urlsInvima.some((u) => u.includes("medicamentos") && u.endsWith("page=2")), "se detiene al encontrar una alerta conocida");
  assert.ok(urlsInvima.some((u) => u.includes("dispositivos") && u.endsWith("page=1")), "DM toda nueva -> revisa la pagina 1");
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
  assert.ok(enviados[0].cuerpo.message.startsWith("[INVIMA] \u{1F50E} *12 alertas nuevas ALTA/MEDIA*"));
  assert.ok(hojas.Historico.filas().every((f) => f.enviado === "SI"));
});

prueba("encuestas: solo ALTA, cuentan en el maximo de 10 mensajes", () => {
  const { g, enviados, estado, registro } = entornoListo();
  estado.html.DM = ENVOLTURA([]);
  const alta = (n) => filaMed("Alerta sanitaria sobre: OZEMPIC lote " + n, "Alerta%20No_" + n + "-2026.pdf");
  const media = (n) => filaMed("Alerta sanitaria sobre: RETIRO PRODUCTO " + n, "Alerta%20No_" + n + "-2026.pdf");
  estado.html.MED = ENVOLTURA([alta(601), media(602)]);
  g.revisarAlertas();
  const sinAviso = enviados.filter((e) => !e.cuerpo.message.includes("No se pudo leer"));
  assert.deepStrictEqual(sinAviso.map((e) => e.url.split("/")[4]), ["sendMessage", "sendPoll", "sendMessage"]);
  // 5 ALTA + 1 MEDIA = 6 mensajes + 5 encuestas = 11 > 10 -> un solo mensaje agrupado, sin encuestas
  const e2 = entornoListo();
  e2.estado.html.DM = ENVOLTURA([]);
  e2.estado.html.MED = ENVOLTURA([alta(611), alta(612), alta(613), alta(614), alta(615), media(616)]);
  e2.g.revisarAlertas();
  const envios2 = e2.enviados.filter((e) => !e.cuerpo.message.includes("No se pudo leer"));
  assert.strictEqual(envios2.length, 1);
  assert.ok(envios2[0].cuerpo.message.includes("*6 alertas nuevas ALTA/MEDIA*"));
  // probarSinEnviar simula la encuesta en el registro
  const e3 = entornoListo();
  e3.estado.html.MED = ENVOLTURA([alta(621)]);
  e3.g.probarSinEnviar();
  assert.strictEqual(e3.enviados.length, 0);
  assert.ok(e3.registro.some((l) => l.includes("[SIMULADO - encuesta no enviada]") && l.includes("( ) \u2705 Sí aplica")));
});

prueba("enviarPruebaEncuesta envia 1 mensaje marcado como prueba + 1 encuesta, sin escribir", () => {
  const { g, hojas, enviados } = entornoListo();
  g.enviarPruebaEncuesta();
  assert.deepStrictEqual(enviados.map((e) => e.url.split("/")[4]), ["sendMessage", "sendPoll"]);
  assert.ok(enviados[0].cuerpo.message.startsWith("\u{1F9EA} *MENSAJE DE PRUEBA*"));
  assert.ok(enviados[0].cuerpo.message.includes("*PRIORIDAD ALTA*"));
  assert.ok(enviados.every((e) => e.cuerpo.chatId === "120363412506101174@g.us"));
  assert.strictEqual(hojas.Historico.d.length, 1);
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

prueba("listado ilegible -> un aviso tecnico por dia", () => {
  const { g, hojas, enviados, estado } = entornoListo();
  estado.html.MED = "<html>mantenimiento</html>";
  g.revisarAlertas();
  g.revisarAlertas();
  const avisos = enviados.filter((e) => e.cuerpo.message.startsWith("[INVIMA] ⚠️ No se pudo leer el listado"));
  assert.strictEqual(avisos.length, 1);
  assert.ok(hojas.Log.filas().some((f) => f.fuente === "MED" && f.estado === "ERROR"));
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
  assert.ok(urlsInvima.includes("https://app.invima.gov.co/alertas/dispositivos-medicos-invima?page=0"));
  assert.ok(registro.some((l) => l.includes("MUESTRA 1") && l.includes("INFORMES")));
  assert.strictEqual(enviados.length, 0);
});

console.log("\nOK: dry run completo, sin llamadas a APIs externas.");
