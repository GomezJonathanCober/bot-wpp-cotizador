# Cotizador Whatsapp

Este bot esta realizado con la biblioteca/framewaork de NodeJS: [builderbot](https://www.builderbot.app/)
El bot se encarga de recibir mensajes de posibles clientes y responder en base a los flujos definidos. Actualmente el bot se encuentra en estado BETA con la capacidad de recibir mensajes y derivar el flujo hasta generar una cotizacion en base a los mensajes recibidos.
Se añadio el envio de Whatsapp Flows (Flujos de Meta) junto con la generacion y el envio de una prepoliza generada por la API de Polizas de Adrian Gustavo Auciello Agüero.

## Para empezar

Los flujos se administran desde: https://business.facebook.com/wa/manage/flows/?business_id=3697629330559967
Instalar send-wpps-ms con gestor npm

```bash
npm install
npm run src/app.js
```

### Variables de entorno

Para ejecutar este proyecto, deberá agregar las siguientes variables de entorno a su archivo .env

`CLOUD_API_ACCESS_TOKEN`
`WA_PHONE_NUMBER_ID`
`WEBHOOK_VERIFICATION_TOKEN`
`PORT_POLKA`
`PORT_EXPRESS`
`URI_API_CREAR_POLIZA`
`URI_API_ACTUALIZAR_POLIZA`
`COTIZADOR_URI`
`FLOW_ENDPOINT`
`PING_CEL`
`APP_SECRET`
`PASSPHRASE`
`PRIVATE_KEY`
`PUBLIC_KEY`

## Documentacion de la libreria (builderbot)

Visitar: [builderbot](https://builderbot.vercel.app/) para ver la documentacion completa.

Con esta biblioteca, puedes crear flujos de conversación automatizados independientes del proveedor de WhatsApp, configurar respuestas automáticas para preguntas frecuentes, recibir y responder mensajes automáticamente y realizar un seguimiento de las interacciones con los clientes. Además, puedes configurar fácilmente activadores para ampliar las funcionalidades sin límites.
