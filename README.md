# alertas-whatsapp-sanitarias-invima

Bot de Google Apps Script ("alertas-sanitarias-invima-hdv") del Servicio Farmacéutico del Hospital Departamental de Villavicencio E.S.E. Vigila las alertas sanitarias de INVIMA (medicamentos y dispositivos médicos) y publica las relevantes para el HDV en el grupo de WhatsApp vía GREEN-API.

> **Estado: en operación.** `Codigo.gs` es la copia del proyecto vivo `alertas-sanitarias-invima-hdv` (sincronizada el 2026-10-20). Puesta en marcha: `inicializarHoja()` → `cargaInicial()` → `probarSinEnviar()` → `instalarDisparadores()`. Operación por disparador: `revisarAlertas()` (6, 10, 14 y 18 h) y `resumenSemanal()` (lunes 7 h).

## Encuesta de socialización

Después de cada alerta enviada de forma individual, el bot envía al mismo grupo una encuesta de WhatsApp (`sendPoll` de GREEN-API, una sola respuesta):

```
🔴 Alerta sanitaria No. 329-2026 (MED): ¿recibió y socializó esta información en su servicio?
( ) ✅ Recibida y socializada en mi servicio
( ) ⏳ Recibida, pendiente por socializar
```

- El círculo de color es el nivel de la alerta (🔴 ALTA, 🟠 MEDIA); los informes de seguridad dicen "Informe de seguridad No. …".
- WhatsApp exige al menos 2 opciones. Se configuran en `OPCIONES_ENCUESTA` (máximo 12, distintas entre sí); `ENCUESTA_ACTIVA = false` la apaga.
- No se envía si la alerta falló, ni con el mensaje agrupado (más de `MAX_MENSAJES` alertas en una ejecución), ni en `probarSinEnviar()` (allí solo se registra). `enviarPruebaAlerta()` sí la envía, para verlo en PRUEBA BOT.
- Cada encuesta cuenta como un mensaje más en la cuota de GREEN-API. Si la encuesta falla, la alerta sigue marcada como enviada; si responde 466, se detienen los envíos siguientes de esa ejecución.
- Las respuestas se ven en el propio WhatsApp; el bot no las lee ni las registra en la hoja.

Pruebas locales: `npm test` (incluye `test/encuesta.js`, sin red ni credenciales).

## Proyecto Apps Script

- Cuenta propietaria: `controldecalidadgases@hdv.gov.co`.
- Proyecto independiente (standalone), sin clasp — misma convención que `alertas-whatsapp-farmacovigilancia`: el código se copia desde `Codigo.gs` al editor.

## Paso 1 — cómo ejecutar la prueba de acceso

1. En [script.google.com](https://script.google.com) (sesión `controldecalidadgases@hdv.gov.co`) crear el proyecto `alertas-sanitarias-invima-hdv`.
2. Configuración del proyecto → marcar "Mostrar el archivo de manifiesto appsscript.json" y pegar `appsscript.json`.
3. Pegar `Codigo.gs`.
4. Seleccionar `probarAcceso` en la barra de herramientas, ejecutar y autorizar.
5. Copiar el registro de ejecución: por cada fuente muestra código HTTP, longitud del HTML, número de enlaces PDF `ckfinder/userfiles/files/ALERTAS...pdf` y las rutas `/alertas/...` encontradas (sirve para confirmar la ruta real de dispositivos médicos).
