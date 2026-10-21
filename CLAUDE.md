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

## Estructura del sitio INVIMA (verificada 2026-10-20)

- MED: `/alertas/medicamentos-productos-biologicos`. DM: `/alertas/dispositivos-medicos-invima` (la ruta `dispositivos-medicos-otras-tecnologias` da 404).
- Ítem: `<div class="views-row ... alertas-invima-list">` con `views-field-title`, `views-field-field-tipo-de-documento`, `views-field-field-a-o` (fecha NO confiable), en DM además `views-field-field-numero-de-id-d-m` y `views-field-field-estado`, y `views-field-field-comunicado-invima` con el enlace "Ver" (URL absoluta, codificada con `%20`).
- DM publica informes de seguridad en `ckfinder/userfiles/files/INFORMES DE SEGURIDAD/...`, con numeración propia → la clave incluye el tipo (`AS`/`IS`).
- Los PDF de DM usan `No_ #355-2026` (con `#`).
- Todo el parseo vive en `parsearListado_(html, fuente)`. Si INVIMA cambia el marcado, ajustar solo esa función y `test/dry-run.js`.

## Convenciones de código

- Un solo `Codigo.gs`, `var`/`function`, nombres y comentarios en español; funciones privadas con sufijo `_`.
- Emojis con `String.fromCodePoint()` en el código `.gs`.
- Toda lógica nueva debe cubrirse en `test/dry-run.js` (`npm test`, ejecutado por el workflow Node.js CI).
