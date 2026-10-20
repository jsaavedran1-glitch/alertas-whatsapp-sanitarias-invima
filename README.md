# alertas-whatsapp-sanitarias-invima

Bot de Google Apps Script ("alertas-sanitarias-invima-hdv") del Servicio Farmacéutico del Hospital Departamental de Villavicencio E.S.E. Vigila las alertas sanitarias de INVIMA (medicamentos y dispositivos médicos) y publica las relevantes para el HDV en el grupo de WhatsApp vía GREEN-API.

> **Estado: Paso 1 (prueba de acceso).** Solo existe `probarAcceso()`. No envía mensajes ni escribe en la hoja. El README completo (despliegue, propiedades, orden de ejecución, reglas) se entrega con la versión funcional.

## Proyecto Apps Script

- Cuenta propietaria: `controldecalidadgases@hdv.gov.co`.
- Proyecto independiente (standalone), sin clasp — misma convención que `alertas-whatsapp-farmacovigilancia`: el código se copia desde `Codigo.gs` al editor.

## Paso 1 — cómo ejecutar la prueba de acceso

1. En [script.google.com](https://script.google.com) (sesión `controldecalidadgases@hdv.gov.co`) crear el proyecto `alertas-sanitarias-invima-hdv`.
2. Configuración del proyecto → marcar "Mostrar el archivo de manifiesto appsscript.json" y pegar `appsscript.json`.
3. Pegar `Codigo.gs`.
4. Seleccionar `probarAcceso` en la barra de herramientas, ejecutar y autorizar.
5. Copiar el registro de ejecución: por cada fuente muestra código HTTP, longitud del HTML, número de enlaces PDF `ckfinder/userfiles/files/ALERTAS...pdf` y las rutas `/alertas/...` encontradas (sirve para confirmar la ruta real de dispositivos médicos).
