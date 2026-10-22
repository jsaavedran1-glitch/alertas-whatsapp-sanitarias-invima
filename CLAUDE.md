# CLAUDE.md — Contexto operativo del proyecto

Reglas para cualquier asistente de IA que continúe este repositorio.

## Qué es

Bot de Google Apps Script (`alertas-sanitarias-invima-hdv`, cuenta `controldecalidadgases@hdv.gov.co`) que vigila las alertas sanitarias e informes de seguridad de INVIMA (medicamentos y dispositivos médicos) y publica las relevantes para el HDV E.S.E. (Villavicencio) en el grupo de WhatsApp vía GREEN-API. Proyecto hermano de `alertas-whatsapp-farmacovigilancia`; comparte la instancia GREEN-API `710722693364` con los bots de Farmacovigilancia, PROA y Tecnovigilancia.

## Reglas de seguridad — NUNCA romper

1. No enviar ningún mensaje real sin confirmación explícita del usuario. Las pruebas van al grupo "PRUEBA BOT" (cambiando `GA_CHAT_ID`), nunca al grupo de producción "Nuevo SF-HDV-SyD-InterSalud".
2. Enviar solo a `GA_CHAT_ID`. Nunca a otro chatId. El plan Developer de GREEN-API permite 3 chats al mes.
3. No usar `checkWhatsapp` ni `getContacts` (consumen cuota mensual).
4. Error 466 (cuota excedida): registrar y no reintentar.
5. Nunca mostrar, registrar ni versionar `GA_TOKEN`. Las credenciales solo en Propiedades del script.
6. Los PDF solo se descargan para extraer la foto del producto (autorizado por el usuario el 20/10/2026): en el envío de alertas MED (`fotoProducto_`) y en `diagnosticarImagenesPdf()`. No analizar su texto. Los PDF de DM no traen fotos (solo la plantilla) y no se descargan al enviar.
7. Exclusivo HDV Villavicencio: nada de Puerto Carreño.
8. Antes de ejecutar una función en el editor, confirmar en el selector que es la correcta (ver CLAUDE.md del bot de Farmacovigilancia: el dropdown a veces no aplica la selección con un clic). Para reemplazar el código completo en Monaco usar `monaco.editor.getModels()[0].setValue(...)`.

## Estructura del sitio INVIMA (sitio nuevo, verificado 2026-10-22)

- Desde el 22/10/2026 INVIMA usa un sitio Odoo: `https://www.invima.gov.co/alertas-sanitarias`, filtrado con `?direccion=` (`da` alimentos, `dm` medicamentos, `dd` dispositivos médicos, `dc` cosméticos) y `?tipo=alerta|informe`. Páginas: `/alertas-sanitarias/page/2?direccion=dm` (12 tarjetas por página). Las rutas viejas de `app.invima.gov.co/alertas/...` devuelven esa misma página sin filtrar.
- Ítem: `<article class="inv-lst-tarjeta inv-dir--dm|dd">` con `inv-lst-cabeza` (dirección y número `358–2026`), `h2.inv-lst-tarjeta-titulo > a` (detalle `/alertas-sanitarias/<slug>`), `span.inv-lst-tag--alerta|--informe` y etiqueta de estado ("En seguimiento"), `inv-lst-fecha` (`dd-mm-aaaa · clasificación`, p. ej. "Producto fraudulento") y el PDF `/alertas-sanitarias/<id>/pdf`. Algunas alertas no traen número ni PDF.
- La numeración de alertas e informes se conserva: las claves `FUENTE:AS|IS:NUM-AÑO` del `Historico` siguen valiendo. Sin número, la clave es `FUENTE:AS:T:<título normalizado>`.
- Todo el parseo vive en `parsearListado_(html, fuente)` → `parsearTarjetas_` (sitio nuevo). Se conserva el parseo Drupal anterior (`views-row`, `ckfinder`) por si INVIMA lo restablece. Si el marcado cambia, ajustar solo esas funciones y `test/dry-run.js`; diagnosticar con `probarAcceso()` e `inspeccionarSitioInvima()`.
- `leerFuentes_` traduce las URL viejas de `Config_Fuentes` a las nuevas (`migrarUrlFuente_`).

## Convenciones de código

- Un solo `Codigo.gs`, `var`/`function`, nombres y comentarios en español; funciones privadas con sufijo `_`.
- Emojis con `String.fromCodePoint()` en el código `.gs`.
- Toda lógica nueva debe cubrirse en `test/dry-run.js` (`npm test`, ejecutado por el workflow Node.js CI).
