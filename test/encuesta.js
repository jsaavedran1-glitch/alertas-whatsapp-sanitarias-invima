// test/encuesta.js
//
// Prueba en seco de la encuesta de socializacion que sigue a cada alerta.
// Carga Codigo.gs con GREEN-API simulado: no sale ninguna peticion de red.
//
// Uso: node test/encuesta.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const PROPS = {
  GA_API_URL: "https://api.ejemplo.invalid",
  GA_ID: "0000000000",
  GA_TOKEN: "token-de-prueba",
  GA_CHAT_ID: "000000000000000000@g.us"
};

function cargar(codigoRespuesta) {
  const llamadas = [];
  const contexto = {
    Logger: { log: () => {} },
    Utilities: { sleep: () => {}, formatDate: () => "2026-10-20" },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => PROPS[k] || null }) },
    UrlFetchApp: {
      fetch: (url, opciones) => {
        const metodo = url.split("/")[4];
        llamadas.push({ metodo, cuerpo: JSON.parse(opciones.payload) });
        const codigo = codigoRespuesta(metodo);
        return { getResponseCode: () => codigo, getContentText: () => "{}" };
      }
    }
  };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "Codigo.gs"), "utf8"), contexto);
  return { ctx: contexto, llamadas };
}

// DM: sin foto, asi no se descarga ningun PDF.
function alerta(numero) {
  return { clave: "DM-" + numero + "-2026", fuente: "DM", tipoCodigo: "AS", numero: String(numero), anio: "2026",
    nivel: "ALTA", titulo: "Alerta sanitaria sobre: producto de prueba", url: "https://ejemplo.invalid/a.pdf" };
}
const registros = () => ({ DM: { fuente: "DM", enviados: 0, estado: "OK", error: "" } });
const modoReal = { nombre: "REVISION", enviar: true, persistir: false };

// 1) Texto de la pregunta y opciones
{
  const { ctx } = cargar(() => 200);
  const it = { fuente: "MED", tipoCodigo: "AS", numero: "329", anio: "2026", nivel: "ALTA" };
  assert.strictEqual(ctx.preguntaEncuesta_(it),
    "\u{1F534} Alerta sanitaria No. 329-2026 (MED): ¿recibió y socializó esta información en su servicio?");
  const opciones = ctx.opcionesEncuesta_().map((o) => o.optionName);
  assert.strictEqual(opciones[0], "✅ Sí");
  assert.strictEqual(opciones[1], "❌ No");
  assert.ok(opciones.length >= 2 && opciones.length <= 12, "WhatsApp exige entre 2 y 12 opciones");
  assert.strictEqual(new Set(opciones).size, opciones.length, "las opciones deben ser distintas");
  console.log("OK pregunta: " + ctx.preguntaEncuesta_(it));
  opciones.forEach((o) => console.log("   ( ) " + o));
}

// 2) Alerta individual -> sendMessage y luego sendPoll de una sola respuesta, al mismo grupo
{
  const { ctx, llamadas } = cargar(() => 200);
  const it = alerta(355);
  ctx.procesarNuevos_(null, [it], registros(), modoReal);
  assert.deepStrictEqual(llamadas.map((l) => l.metodo), ["sendMessage", "sendPoll"]);
  const poll = llamadas[1].cuerpo;
  assert.strictEqual(poll.chatId, PROPS.GA_CHAT_ID);
  assert.strictEqual(poll.multipleAnswers, false);
  assert.ok(poll.message.indexOf("Alerta sanitaria No. 355-2026 (DM)") > -1);
  assert.strictEqual(it.enviado, "SI");
  console.log("OK alerta individual: mensaje + encuesta");
}

// 3) Si la alerta no se envia, no se envia encuesta
{
  const { ctx, llamadas } = cargar(() => 500);
  ctx.procesarNuevos_(null, [alerta(356)], registros(), modoReal);
  assert.deepStrictEqual(llamadas.map((l) => l.metodo), ["sendMessage"]);
  console.log("OK alerta fallida: sin encuesta");
}

// 4) Encuesta fallida no cambia el estado de la alerta; 466 en la encuesta detiene los envios siguientes
{
  const { ctx, llamadas } = cargar((m) => (m === "sendPoll" ? 466 : 200));
  const a = alerta(357), b = alerta(358);
  const cuota = ctx.procesarNuevos_(null, [a, b], registros(), modoReal);
  assert.strictEqual(a.enviado, "SI");
  assert.strictEqual(b.enviado, "NO_ENVIADO_466");
  assert.strictEqual(cuota, true);
  assert.deepStrictEqual(llamadas.map((l) => l.metodo), ["sendMessage", "sendPoll"]);
  console.log("OK cuota 466 en la encuesta: alerta queda SI y se detienen los siguientes envios");
}

// 5) Mensaje agrupado (> MAX_MENSAJES) -> sin encuesta
{
  const { ctx, llamadas } = cargar(() => 200);
  const muchas = [];
  for (let i = 0; i < ctx.MAX_MENSAJES + 1; i++) muchas.push(alerta(400 + i));
  ctx.procesarNuevos_(null, muchas, registros(), modoReal);
  assert.deepStrictEqual(llamadas.map((l) => l.metodo), ["sendMessage"]);
  console.log("OK mensaje agrupado: sin encuesta");
}

// 6) Modo simulado -> ninguna llamada a GREEN-API
{
  const { ctx, llamadas } = cargar(() => 200);
  ctx.procesarNuevos_(null, [alerta(500)], registros(), { nombre: "PRUEBA", enviar: false, persistir: false });
  assert.strictEqual(llamadas.length, 0);
  console.log("OK modo simulado: nada enviado");
}

console.log("\nOK: encuesta verificada sin llamadas a APIs externas.");
