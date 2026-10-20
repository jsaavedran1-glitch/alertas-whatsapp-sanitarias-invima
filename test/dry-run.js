// test/dry-run.js
//
// Carga Codigo.gs en Node.js con simulaciones de UrlFetchApp, Logger y Utilities,
// y ejecuta las funciones contra HTML de ejemplo, SIN acceder a INVIMA,
// SIN credenciales y SIN enviar nada real.
//
// Uso: npm test   (o: node test/dry-run.js)

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const util = require("util");
const assert = require("assert");

// HTML de ejemplo con el formato de enlaces observado en probarAcceso() (2026-10-20).
const HTML_EJEMPLO =
  '<a href="/alertas/dispositivos-medicos-invima">DM</a>' +
  '<a href="https://app.invima.gov.co/alertas/ckfinder/userfiles/files/INFORMES%20DE%20SEGURIDAD/Dispositivos/2026/Octubre/Informe%20de%20seguridad%20No_%20%23148-2026%20.pdf">Ver</a>' +
  '<a href="https://app.invima.gov.co/alertas/ckfinder/userfiles/files/ALERTAS%20SANITARIAS/medicamentos_pbiologicos/2026/OCTUBRE/Alerta%20No_330-2026%20-%20ETHIOPIAN%20BLACK%20SEED%20OIL.pdf">Ver</a>' +
  '<a href="https://app.invima.gov.co/alertas/ckfinder/userfiles/files/ALERTAS%20SANITARIAS/Dispositivos_Medicos/2026/Octubre/Alerta%20No_%20%23355-2026%20-%20HemoslL%20AcuStar.pdf">Ver</a>';

function cargarCodigo() {
  const registro = [];
  const urls = [];
  const contexto = {
    Logger: { log: (...a) => registro.push(util.format(...a)) },
    Utilities: { sleep: () => {} },
    UrlFetchApp: {
      fetch: (url) => {
        urls.push(url);
        return { getResponseCode: () => 200, getContentText: () => HTML_EJEMPLO };
      }
    }
  };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "Codigo.gs"), "utf8"), contexto);
  return { contexto, registro, urls };
}

// 1. probarAcceso: consulta MED, DM (ruta corregida) e indice, y cuenta los PDF.
(function () {
  const { contexto, registro, urls } = cargarCodigo();
  contexto.probarAcceso();
  assert.ok(urls.includes("https://app.invima.gov.co/alertas/dispositivos-medicos-invima?page=0"), "ruta DM");
  assert.strictEqual(urls.length, 3);
  assert.ok(registro.some((l) => l.includes("enlaces PDF ALERTAS=")), "registro de conteo");
  console.log("OK probarAcceso");
})();

// 2. volcarMuestraHtml: registra muestras de HTML sin enviar nada.
(function () {
  const { contexto, registro } = cargarCodigo();
  contexto.volcarMuestraHtml();
  assert.ok(registro.some((l) => l.includes("MUESTRA 1") && l.includes("INFORMES")), "muestra de informe registrada");
  assert.ok(registro.some((l) => l.includes("MUESTRA 2")), "segunda muestra registrada");
  console.log("OK volcarMuestraHtml");
})();

// 3. Extraccion de numero/anio desde el nombre del PDF (incluye el "#" de DM).
(function () {
  const extraer = (s) => decodeURIComponent(s).match(/No_?\s*#?\s*(\d+)\s*-\s*(\d{4})/i).slice(1, 3);
  assert.deepStrictEqual(extraer("Alerta%20No_%20%23355-2026%20-%20Hemos.pdf"), ["355", "2026"]);
  assert.deepStrictEqual(extraer("Alerta%20No_323-2026%20.pdf"), ["323", "2026"]);
  assert.deepStrictEqual(extraer("Alerta%20No_%20322-2026%20LYMPHATIC.pdf"), ["322", "2026"]);
  console.log("OK extraccion de clave");
})();

console.log("\nOK: dry run completo, sin llamadas a APIs externas.");
