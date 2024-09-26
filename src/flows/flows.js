import { actualizarPoliza } from "../api_polizas/actualizar.js";
import { updateCell } from "../sheet_google/updateData.js";
import { decryptRequest, encryptResponse } from "./encryption.js";
import crypto from "crypto";

const form = {};
const createPoliza = {};
const updatePoliza = {};

export async function generateAndSendFlow(from, data, tokenPoliza) {
	let celFormateado = from.slice(0, 2) + from.slice(3);
	form[from] = data;
	const myHeaders = new Headers();
	myHeaders.append("Content-Type", "application/json");
	myHeaders.append(
		"Authorization",
		`Bearer ${process.env.CLOUD_API_ACCESS_TOKEN}`
	);
	let flow_token = from;
	const raw = JSON.stringify({
		messaging_product: "whatsapp",
		to: celFormateado,
		recipient_type: "individual",
		type: "interactive",
		interactive: {
			type: "flow",
			header: {
				type: "text",
				text: "Solicitud de reserva precio promocional",
			},
			body: {
				text: "Completando el siguiente formulario el usuario reserva durante 72 hs un cupo para la contratación de cualquiera de los planes médico asistenciales ofrecidos por Cober medicina privada.\nEl mismo no es de carácter contractual y queda sujeto a aprobación del departamento comercial y auditoría.\nPromoción válida únicamente para nuevas contrataciones.",
			},
			footer: {
				text: "Superintendencia de Servicios de Salud | R.N.E.M.P: 111537",
			},
			action: {
				name: "flow",
				parameters: {
					flow_id: "2336495346690501",
					flow_message_version: "3",
					flow_token: flow_token, //,
					flow_cta: "Solicitar reserva",
					flow_action: "navigate",
					flow_action_payload: {
						screen: "TITULAR",
						data: {
							city: [
								{
									id: "CABA",
									title: "CABA",
								},
								{
									id: "GBA-Norte",
									title: "GBA Zona Norte",
								},
								{
									id: "GBA-Sur",
									title: "GBA Zona Sur",
								},
								{
									id: "GBA-Oeste",
									title: "GBA Zona Oeste",
								},
							],
							plans: [
								{
									id: "Classic_X",
									title: "Classic X",
								},
								{
									id: "Oxford",
									title: "Oxford",
								},
								{
									id: "Taylored",
									title: "Taylored",
								},
								{
									id: "Wagon",
									title: "Wagon",
								},
							],
							//plan: msg,
							name: data.titular,
							email: data.correo,
							cel: data.cel,
						}, //
					},
				},
			},
		},
	});
	fetch(
		`https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
		{
			method: "POST",
			headers: myHeaders,
			body: raw,
			redirect: "follow",
		}
	)
		.then((response) => response.text())
		.then((result) => {
			if (result) {
				console.log(result);
				updateCell(data["userRow"], 19, "Formulario Enviado").then((res) => {
					createPoliza[flow_token] = {};
					Object.assign(createPoliza[flow_token], data);
					updatePoliza[flow_token] = {
						termycond: "on",
						tokenPol: tokenPoliza,
						update: true,
					};
				});
			}
		}) //result
		.catch((error) => console.error(error));
}

export async function recibirDataFlow(req, res) {
	if (!process.env.PRIVATE_KEY) {
		throw new Error(
			'Private key is empty. Please check your env variable "PRIVATE_KEY".'
		);
	}
	if (!isRequestSignatureValid(req)) {
		// Return status code 432 if request signature does not match.
		// To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
		return res.status(432).send();
	}

	let decryptedRequest = null;
	try {
		decryptedRequest = decryptRequest(
			req.body,
			process.env.PRIVATE_KEY,
			process.env.PASSPHRASE
		);
	} catch (err) {
		console.error(err);
		if (err instanceof FlowEndpointException) {
			return res.status(err.statusCode).send();
		}
		return res.status(500).send();
	}

	const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
	//console.log("💬 Decrypted Request:", decryptedBody);
	let { action } = decryptedBody;
	//console.log("Action:", action);

	const { screenResponse, userId } = await getNextScreen(decryptedBody);

	//console.log("👉 Response to Encrypt:", screenResponse);
	if (screenResponse && screenResponse["screen"] === "DESPEDIDA") {
		await actualizarPoliza(updatePoliza[userId], userId);
		/* console.log("-----------------------------");
		console.log("CREATE POLIZA:", createPoliza[userId]);
		console.log("-----------------------------");
		console.log("UPDATE POLIZA:", updatePoliza[userId]);
		console.log("-----------------------------"); */
		await updateCell(createPoliza[userId].userRow, 19, "Formulario Terminado");
		delete createPoliza[userId];
		delete updatePoliza[userId];
	}
	//console.log(screenResponse);
	if (!screenResponse["screen"]) {
		res.send(
			encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
		);
		return;
	}
	res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
	return;
}
async function getNextScreen(decryptedBody) {
	const SCREEN_RESPONSES = {
		ESPOSA: {
			version: "3.0",
			screen: "ESPOSA",
			data: {},
		},
		HIJO_UNO: {
			version: "3.0",
			screen: "HIJO_UNO",
			data: {},
		},
		HIJO_DOS: {
			version: "3.0",
			screen: "HIJO_DOS",
			data: {},
		},
		HIJO_TRES: {
			version: "3.0",
			screen: "HIJO_TRES",
			data: {},
		},
		DEC_TITULAR: {
			version: "3.0",
			screen: "DEC_TITULAR",
			data: {},
		},
		DEC_ESPOSA: {
			version: "3.0",
			screen: "DEC_ESPOSA",
			data: {},
		},
		DEC_HIJO_UNO: {
			version: "3.0",
			screen: "DEC_HIJO_UNO",
			data: {},
		},
		DEC_HIJO_DOS: {
			version: "3.0",
			screen: "DEC_HIJO_DOS",
			data: {},
		},
		DEC_HIJO_TRES: {
			version: "3.0",
			screen: "DEC_HIJO_TRES",
			data: {},
		},
		DESPEDIDA: {
			version: "3.0",
			screen: "DESPEDIDA",
			data: {},
		},
	};

	const { screen, data, version, action, flow_token } = decryptedBody;
	let userId = flow_token;
	if (action === "data_exchange") {
		/* if (flow_token) {
			console.log("Aca deberia ir el num del cliente:", flow_token);
		} */
		let screenResponse = null;
		switch (screen) {
			case "TITULAR":
				data.fecha_nac_titular = convertirEpochAFecha(data.fecha_nac_titular);
				updatePoliza[flow_token].costo_plan =
					createPoliza[userId].costo_plan[data.plan];
				updatePoliza[flow_token].final = createPoliza[userId].final[data.plan];
				updatePoliza[flow_token].promo = String(createPoliza[userId].promo);
				Object.assign(updatePoliza[flow_token], data);
				if (form[flow_token]["estadoTit"] === "Individual") {
					if (form[flow_token]["hijos"] === "Si") {
						//console.log("Next Screen: HIJO_UNO");
						screenResponse = { ...SCREEN_RESPONSES.HIJO_UNO };
					}
					if (form[flow_token]["hijos"] === "No") {
						//console.log("Next Screen: DEC_TITULAR");
						screenResponse = { ...SCREEN_RESPONSES.DEC_TITULAR };
					}
				}
				if (form[flow_token]["estadoTit"] === "Matrimonio") {
					//console.log("Next Screen: ESPOSA");
					screenResponse = { ...SCREEN_RESPONSES.ESPOSA };
				}
				break;
			case "ESPOSA":
				data.fecha_nac_conyuge = convertirEpochAFecha(data.fecha_nac_conyuge);
				Object.assign(updatePoliza[flow_token], data);
				if (form[flow_token]["hijos"] === "Si") {
					//console.log("Next Screen: HIJO_UNO");
					screenResponse = { ...SCREEN_RESPONSES.HIJO_UNO };
				}
				if (form[flow_token]["hijos"] === "No") {
					//console.log("Next Screen: DEC_TITULAR");
					screenResponse = { ...SCREEN_RESPONSES.DEC_TITULAR };
				}
				break;
			case "HIJO_UNO":
				updatePoliza[flow_token].datos_hijos = [];
				data.fnac_hijo = convertirEpochAFecha(data.fnac_hijo);
				updatePoliza[flow_token].datos_hijos.push(data);
				if (form[flow_token]["edadeshijos"].length > 1) {
					//console.log("Next Screen: HIJO_DOS");
					screenResponse = { ...SCREEN_RESPONSES.HIJO_DOS };
				} else {
					//console.log("Next Screen: DEC_TITULAR");
					screenResponse = { ...SCREEN_RESPONSES.DEC_TITULAR };
				}
				break;
			case "HIJO_DOS":
				data.fnac_hijo = convertirEpochAFecha(data.fnac_hijo);
				updatePoliza[flow_token].datos_hijos.push(data);
				if (form[flow_token]["edadeshijos"].length > 2) {
					//console.log("Next Screen: HIJO_TRES");
					screenResponse = { ...SCREEN_RESPONSES.HIJO_TRES };
				} else {
					//console.log("Next Screen: DEC_TITULAR");
					screenResponse = { ...SCREEN_RESPONSES.DEC_TITULAR };
				}
				break;
			case "HIJO_TRES":
				data.fnac_hijo = convertirEpochAFecha(data.fnac_hijo);
				updatePoliza[flow_token].datos_hijos.push(data);
				//console.log("Next Screen: DEC_TITULAR");
				screenResponse = { ...SCREEN_RESPONSES.DEC_TITULAR };
				break;
			case "DEC_TITULAR":
				for (let key in data) {
					if (data[key] === "Si") {
						updatePoliza[flow_token].update = false;
						console.log(
							"PREEXISTENCIA TITULAR",
							createPoliza[flow_token].userRow
						);
						await updateCell(
							createPoliza[flow_token].userRow,
							19,
							"Preexistencia"
						);
						break;
					}
				}
				updatePoliza[flow_token].pesoTit = data.pesoTitular;
				updatePoliza[flow_token].alturaTit = data.alturaTitular;
				if (form[flow_token]["estadoTit"] === "Individual") {
					if (form[flow_token]["hijos"] === "Si") {
						//console.log("Next Screen: DEC_HIJO_UNO");
						screenResponse = { ...SCREEN_RESPONSES.DEC_HIJO_UNO };
					}
					if (form[flow_token]["hijos"] === "No") {
						//console.log("Next Screen: DESPEDIDA");
						screenResponse = { ...SCREEN_RESPONSES.DESPEDIDA };
					}
				}
				if (form[flow_token]["estadoTit"] === "Matrimonio") {
					//console.log("Next Screen: DEC_ESPOSA");
					screenResponse = { ...SCREEN_RESPONSES.DEC_ESPOSA };
				}
				break;
			case "DEC_ESPOSA":
				for (let key in data) {
					if (data[key] === "Si") {
						updatePoliza[flow_token].update = false;
						await updateCell(
							createPoliza[flow_token].userRow,
							19,
							"Preexistencia"
						);
						break;
					}
				}
				updatePoliza[flow_token].pesoCony = data.pesoEsposa;
				updatePoliza[flow_token].alturaCony = data.alturaEsposa;
				if (form[flow_token]["hijos"] === "Si") {
					//console.log("Next Screen: DEC_HIJO_UNO");
					screenResponse = { ...SCREEN_RESPONSES.DEC_HIJO_UNO };
				}
				if (form[flow_token]["hijos"] === "No") {
					//console.log("Next Screen: DESPEDIDA");
					screenResponse = { ...SCREEN_RESPONSES.DESPEDIDA };
				}
				break;
			case "DEC_HIJO_UNO":
				for (let key in data) {
					if (data[key] === "Si") {
						updatePoliza[flow_token].update = false;
						await updateCell(
							createPoliza[flow_token].userRow,
							19,
							"Preexistencia"
						);
						break;
					}
				}
				updatePoliza[flow_token].vPesoAlturaHijos = [];
				updatePoliza[flow_token].vPesoAlturaHijos.push({
					peso_hijo: data.pesoHijoUno,
					altura_hijo: data.alturaHijoUno,
					fum_hijo: "",
				});
				if (form[flow_token]["edadeshijos"].length > 1) {
					//console.log("Next Screen: DEC_HIJO_DOS");
					screenResponse = { ...SCREEN_RESPONSES.DEC_HIJO_DOS };
				} else {
					//console.log("Next Screen: DESPEDIDA");
					screenResponse = { ...SCREEN_RESPONSES.DESPEDIDA };
				}
				break;
			case "DEC_HIJO_DOS":
				for (let key in data) {
					if (data[key] === "Si") {
						updatePoliza[flow_token].update = false;
						await updateCell(
							createPoliza[flow_token].userRow,
							19,
							"Preexistencia"
						);
						break;
					}
				}
				updatePoliza[flow_token].vPesoAlturaHijos.push({
					peso_hijo: data.pesoHijoDos,
					altura_hijo: data.alturaHijoDos,
					fum_hijo: "",
				});
				if (form[flow_token]["edadeshijos"].length > 2) {
					//console.log("Next Screen: DEC_HIJO_TRES");
					screenResponse = { ...SCREEN_RESPONSES.DEC_HIJO_TRES };
				} else {
					//console.log("Next Screen: DESPEDIDA");
					screenResponse = { ...SCREEN_RESPONSES.DESPEDIDA };
				}
				break;
			case "DEC_HIJO_TRES":
				for (let key in data) {
					if (data[key] === "Si") {
						updatePoliza[flow_token].update = false;
						await updateCell(
							createPoliza[flow_token].userRow,
							19,
							"Preexistencia"
						);
						break;
					}
				}
				updatePoliza[flow_token].vPesoAlturaHijos.push({
					peso_hijo: data.pesoHijoTres,
					altura_hijo: data.alturaHijoTres,
					fum_hijo: "",
				});
				//console.log("Next Screen: DESPEDIDA");
				screenResponse = { ...SCREEN_RESPONSES.DESPEDIDA };
		}
		return { screenResponse, userId };
	}

	if (action === "INIT") {
		console.log(`Action = ${action}`);
	}

	if (action === "navigate") {
		console.log(`Action = ${action}`);
	}

	if (action === "complete") {
		console.log(`Action = ${action}`);
		//console.log("DATA POLIZA:", updatePoliza[flow_token]);
	}

	// handle health check request
	if (action === "ping") {
		let screenResponse = {
			data: {
				status: "active",
			},
		};
		return { screenResponse };
	}

	// handle error notification
	if (data?.error) {
		console.warn("Received client error:", data);
		return {
			version,
			data: {
				acknowledged: true,
			},
		};
	}

	console.error("Unhandled request body:", decryptedBody);
	throw new Error(
		"Unhandled endpoint request. Make sure you handle the request action & screen logged above."
	);
}

function isRequestSignatureValid(req) {
	if (!process.env.APP_SECRET) {
		console.log("No se encontro APP Secret");
		return true;
	}
	const signatureHeader = req.get("x-hub-signature-256");
	const signatureBuffer = Buffer.from(
		signatureHeader.replace("sha256=", ""),
		"utf-8"
	);
	const hmac = crypto.createHmac("sha256", process.env.APP_SECRET);
	const digestString = hmac.update(req.rawBody).digest("hex");
	const digestBuffer = Buffer.from(digestString, "utf-8");

	if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
		console.error("Error: Request Signature did not match");
		return false;
	} else {
		console.log("Firma Validada");
	}
	return true;
}

function convertirEpochAFecha(epoch) {
	// Crear un objeto Date a partir del valor epoch

	let fecha = new Date(parseInt(epoch));

	// Obtener los componentes de la fecha
	let dia = fecha.getDate();
	let mes = fecha.getMonth() + 1; // Los meses en JavaScript van de 0 a 11, por eso sumamos 1
	let año = fecha.getFullYear();

	// Formatear la fecha en "día/mes/año"
	return `${dia}/${mes}/${año}`;
}
