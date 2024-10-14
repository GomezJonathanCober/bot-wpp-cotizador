import {
	createBot,
	createProvider,
	createFlow,
	addKeyword,
	EVENTS,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import { configDotenv } from "dotenv";
import { pausa } from "./utils/functions.js";
import {
	validarEdad,
	validarEmail,
	validarNombre,
	validarSueldo,
} from "./utils/validators.js";
import { dataToSheet } from "./sheet_google/data.js";
import { getQuote } from "../src/sheet_google/getQuote.js";
import { writeRowInSheet } from "./sheet_google/postData.js";
import { updateCell } from "./sheet_google/updateData.js";
import { registrarPoliza } from "./api_polizas/registrar.js";
import { generateAndSendFlow, recibirDataFlow } from "./flows/flows.js";
import express from "express";
configDotenv();

const app = express(); //Para recibir los intercambios con el Webhook
const PORT_POLKA = process.env.PORT_POLKA ?? 3008;

app.use(
	express.json({
		// store the raw request body to use it for signature verification
		verify: (req, res, buf, encoding) => {
			req.rawBody = buf?.toString(encoding || "utf8");
		},
	})
);

const flowGenerarCotizacion = addKeyword(EVENTS.ACTION)
	.addAction(async (ctx, { flowDynamic, provider, state, endFlow }) => {
		state.update({ cel: ctx.from });
		await provider.sendMessage(
			ctx.from,
			"¡Gracias por completar el formulario!\n\nEsperá un momento por favor, estamos generando tu cotización📃",
			{
				options: null,
			}
		);
		let data = dataToSheet(state.getMyState());
		let row = await writeRowInSheet(data);
		state.update({ userRow: row });
		await pausa(1000);
		let cotizacion = await getQuote(row, data);
		if (!cotizacion) {
			console.log("Edad > 60");
			await updateCell(state.get("userRow"), 19, "Contactar Asesor Edad > 60");
			await provider.sendMessage(
				ctx.from,
				"Tus datos fueron recibidos correctamente. A la brevedad un asesor comercial se contactará con vos.",
				{
					options: null,
				}
			);
			state.clear();
			return endFlow();
		}
		let { quotesMsgs, quotesImages } = generateMsgsQuotes(cotizacion, data);
		await state.update({ promo: cotizacion.titular.Promo * 100 });
		await state.update({ costo_plan: cotizacion.quotePure });
		await state.update({ final: cotizacion.quoteDs });
		for (let plan in quotesMsgs) {
			await flowDynamic([
				{ body: quotesMsgs[plan], media: quotesImages[plan].link },
			]);
			//await provider.sendImageUrl(ctx.from, quotesImages[plan]);
			await pausa(500);
			/* await provider.sendMessage(ctx.from, quotesMsgs[plan], {
				options: null,
			}); */
		}
		await pausa(2000); //Tiempo a esperar hasta enviar botones
		let buttons = [{ body: "Reservar" }, { body: "Contactar Asesor" }];

		await provider.sendButtons(
			ctx.from,
			buttons,
			`Para reservar estas cotizaciones por 72hrs te pedimos que completes el siguiente formulario`
		); //Selecciona el plan que más te interesa
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, endFlow }) => {
			if (ctx.body !== "Reservar" && ctx.body !== "Contactar Asesor") {
				await provider.sendMessage(ctx.from, "*Opcion Invalida", {
					options: null,
				});
				let buttons = [{ body: "Reservar" }, { body: "Contactar Asesor" }];
				await provider.sendButtons(
					ctx.from,
					buttons,
					`Para reservar estas cotizaciones por 72hrs te pedimos que valides tus datos`
				);
				return fallBack();
			}
			if (ctx.body === "Reservar") {
				let data = {};
				data[ctx.from] = state.getMyState();
				await updateCell(state.get("userRow"), 19, "Formulario Iniciado");
				let poliza = await registrarPoliza(data[ctx.from]);
				await generateAndSendFlow(ctx.from, data[ctx.from], poliza.tokenPol);
				state.clear();
				return endFlow();
			}
			if (ctx.body === "Contactar Asesor") {
				await updateCell(state.get("userRow"), 19, "Contactar Asesor");
				await provider.sendMessage(
					ctx.from,
					"Tus datos fueron recibidos correctamente. A la brevedad un asesor comercial se contactará con vos.",
					{
						options: null,
					}
				);
				state.clear();
				return endFlow();
			}
		}
	);

const flowHijo = addKeyword(EVENTS.ACTION)
	.addAction(async (ctx, { provider }) => {
		await provider.sendMessage(ctx.from, "Ingresá la *edad* de tu *hijo/a*:", {
			options: null,
		});
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (!validarEdad(ctx.body, "Hijo")) {
				await provider.sendMessage(
					ctx.from,
					"*Edad* de hijo invalida, reingresa una edad valida",
					{
						options: null,
					}
				);
				return fallBack();
			}
			let cantHijos = state.get("cantHijos");
			let edadeshijos = state.get("edadeshijos");
			edadeshijos.push({ edad_hijo: ctx.body });
			await state.update({ edadeshijos: edadeshijos });
			if (edadeshijos.length < parseInt(cantHijos)) {
				await provider.sendMessage(
					ctx.from,
					"Ingresá la *edad* de tu *hijo/a*:",
					{
						options: null,
					}
				);
				return fallBack();
			}
			if (edadeshijos.length === parseInt(cantHijos)) {
				return gotoFlow(flowDataTitular);
			}
		}
	);
const flowSocio = addKeyword("Soy Socio").addAnswer(
	"Para que podamos brindarte el mejor servicio ingresá desde tu *PC* a: https://cober.com.ar/afiliados/cober-touch/ \n\nTambién podés descargar nuestra aplicación *CoberTouch* desde tu dispositivo móvil\n\n*Android*: https://play.google.com/store/apps/details?id=ar.com.cober.www.twa&pli=1\n\n*IOs*: https://www.cober.com.ar/app/pwa/ingresar\n\nSi deseás comunicarte con nuestros representantes: https://cober.com.ar/afiliados/telefonos/\n\nPreguntas frecuentes: https://cober.com.ar/afiliados/dudas-frecuentes/\n\nPara volver al menu principal ingresa cualquier mensaje"
);

const flowDataTitular = addKeyword(EVENTS.ACTION)
	.addAction(async (ctx, { provider }) => {
		const list = {
			header: {
				type: "text",
				text: "",
			},
			body: {
				text: "Y por último, selecciona tu *tipo de afiliación*",
			},
			footer: {
				text: "",
			},
			action: {
				button: "AFILIACIONES",
				sections: [
					{
						rows: [
							{
								id: "Particular",
								title: "Particular",
							},
							{
								id: "dependencyRelationship",
								title: "Recibo de sueldo",
							},
							{
								id: "categoryMonotribute",
								title: "Monotributo",
							},
							{
								id: "Salir",
								title: "Volver al menu principal",
							},
						],
					},
				],
			},
		};
		await provider.sendList(ctx.from, list);
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (
				ctx.type !== "interactive" ||
				(ctx.body !== "Particular" &&
					ctx.body !== "dependencyRelationship" &&
					ctx.body !== "categoryMonotribute" &&
					ctx.body !== "Salir")
			) {
				const list = {
					header: {
						type: "text",
						text: "",
					},
					body: {
						text: "Y por último, selecciona tu *tipo de afiliación*",
					},
					footer: {
						text: "",
					},
					action: {
						button: "AFILIACIONES",
						sections: [
							{
								rows: [
									{
										id: "Particular",
										title: "Particular",
									},
									{
										id: "dependencyRelationship",
										title: "Recibo de sueldo",
									},
									{
										id: "categoryMonotribute",
										title: "Monotributo",
									},
									{
										id: "Salir",
										title: "Volver al menu principal",
									},
								],
							},
						],
					},
				};
				await provider.sendMessage(
					ctx.from,
					"*Tipo de afiliación* ingresada incorrecta. Seleccioná una de las opciones validas",
					{ options: null }
				);
				await provider.sendList(ctx.from, list);
				return fallBack();
			}
			if (ctx.body === "Salir") {
				state.clear();
				return gotoFlow(flowSaludo);
			}
			await state.update({ tipoAfiTit: ctx.title_list_reply });
			if (ctx.body === "dependencyRelationship") {
				return gotoFlow(flowSueldoTitular);
			}
			if (ctx.body === "categoryMonotribute") {
				return gotoFlow(flowMonotributoTitular);
			}
			if (ctx.body === "Particular") {
				return gotoFlow(flowGenerarCotizacion);
			}
		}
	);

const flowDataConyuge = addKeyword(EVENTS.ACTION)
	.addAction(async (ctx, { provider }) => {
		await provider.sendMessage(ctx.from, "Ingresá la *edad* de tu *pareja*:", {
			options: null,
		});
	})
	.addAction({ capture: true }, async (ctx, { state, fallBack, provider }) => {
		if (!validarEdad(ctx.body, "Esposa")) {
			await provider.sendMessage(
				ctx.from,
				"*Edad* de *pareja* invalida, reingresa una edad valida",
				{
					options: null,
				}
			);
			return fallBack();
		}
		await state.update({ edadCony: ctx.body });
		return;
	})
	.addAction(async (ctx, { provider }) => {
		const list = {
			header: {
				type: "text",
				text: "",
			},
			body: {
				text: "*Tipo de afiliación* de tu *Esposa/Pareja*",
			},
			footer: {
				text: "",
			},
			action: {
				button: "AFILIACIONES",
				sections: [
					{
						rows: [
							{
								id: "Particular",
								title: "Particular",
							},
							{
								id: "dependencyRelationship",
								title: "Recibo de sueldo",
							},
							{
								id: "categoryMonotribute",
								title: "Monotributo",
							},
							{
								id: "Salir",
								title: "Volver al menu principal",
							},
						],
					},
				],
			},
		};
		await provider.sendList(ctx.from, list);
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (
				ctx.type !== "interactive" ||
				(ctx.body !== "Particular" &&
					ctx.body !== "dependencyRelationship" &&
					ctx.body !== "categoryMonotribute" &&
					ctx.body !== "Salir")
			) {
				const list = {
					header: {
						type: "text",
						text: "",
					},
					body: {
						text: "*Tipo de afiliación* de tu *Esposa/Pareja*",
					},
					footer: {
						text: "",
					},
					action: {
						button: "AFILIACIONES",
						sections: [
							{
								rows: [
									{
										id: "Particular",
										title: "Particular",
									},
									{
										id: "dependencyRelationship",
										title: "Recibo de sueldo",
									},
									{
										id: "categoryMonotribute",
										title: "Monotributo",
									},
									{
										id: "Salir",
										title: "Volver al menu principal",
									},
								],
							},
						],
					},
				};
				await provider.sendMessage(
					ctx.from,
					"*Tipo de afiliación* de tu *esposa/pareja* ingresada incorrecta. Selecciona una de las opciones validas",
					{ options: null }
				);
				await provider.sendList(ctx.from, list);
				return fallBack();
			}
			if (ctx.body === "Salir") {
				state.clear();
				return gotoFlow(flowSaludo);
			}
			await state.update({ tipoAfiCony: ctx.title_list_reply });
			if (ctx.body === "dependencyRelationship") {
				return gotoFlow(flowSueldoConyuge);
			}
			if (ctx.body === "categoryMonotribute") {
				return gotoFlow(flowMonotributoConyuge);
			}
			let hijos = state.get("cantHijos");
			if (hijos && ctx.body === "Particular") {
				return gotoFlow(flowHijo);
			}
			return gotoFlow(flowDataTitular);
		}
	);
const flowMonotributoTitular = addKeyword(EVENTS.ACTION)
	.addAction(async (ctx, { provider }) => {
		const list = {
			header: {
				type: "text",
				text: "",
			},
			body: {
				text: "Selecciona tu *Categoria de Monotributo*",
			},
			footer: {
				text: "",
			},
			action: {
				button: "CATEGORIAS",
				sections: [
					{
						rows: [
							{
								id: "ABC",
								title: "Categoria A - B - C",
							},
							{
								id: "D",
								title: "Categoria D",
							},
							{
								id: "E",
								title: "Categoria E",
							},
							{
								id: "F",
								title: "Categoria F",
							},
							{
								id: "G",
								title: "Categoria G",
							},
							{
								id: "H",
								title: "Categoria H",
							},
							{
								id: "I",
								title: "Categoria I",
							},
							{
								id: "J",
								title: "Categoria J",
							},
							{
								id: "K",
								title: "Categoria K",
							},
							{
								id: "Salir",
								title: "Volver al menu principal",
							},
						],
					},
				],
			},
		};
		await provider.sendList(ctx.from, list);
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (
				ctx.type !== "interactive" ||
				(ctx.body !== "ABC" &&
					ctx.body !== "D" &&
					ctx.body !== "E" &&
					ctx.body !== "F" &&
					ctx.body !== "G" &&
					ctx.body !== "H" &&
					ctx.body !== "I" &&
					ctx.body !== "J" &&
					ctx.body !== "K" &&
					ctx.body !== "Salir")
			) {
				const list = {
					header: {
						type: "text",
						text: "",
					},
					body: {
						text: "Selecciona tu *Categoria de Monotributo*",
					},
					footer: {
						text: "",
					},
					action: {
						button: "CATEGORIAS",
						sections: [
							{
								rows: [
									{
										id: "ABC",
										title: "Categoria A - B - C",
									},
									{
										id: "D",
										title: "Categoria D",
									},
									{
										id: "E",
										title: "Categoria E",
									},
									{
										id: "F",
										title: "Categoria F",
									},
									{
										id: "G",
										title: "Categoria G",
									},
									{
										id: "H",
										title: "Categoria H",
									},
									{
										id: "I",
										title: "Categoria I",
									},
									{
										id: "J",
										title: "Categoria J",
									},
									{
										id: "K",
										title: "Categoria K",
									},
									{
										id: "Salir",
										title: "Volver al menu principal",
									},
								],
							},
						],
					},
				};
				await provider.sendMessage(
					ctx.from,
					"*Categoria de monotributo* ingresada incorrecta. Selecciona una de las opciones validas",
					{ options: null }
				);
				await provider.sendList(ctx.from, list);
				return fallBack();
			}
			if (ctx.body === "Salir") {
				state.clear();
				return gotoFlow(flowSaludo);
			}
			await state.update({ cate_mono_tit: ctx.title_list_reply });
			return gotoFlow(flowGenerarCotizacion);
		}
	);

const flowSueldoTitular = addKeyword(EVENTS.ACTION).addAnswer(
	"Ingresa tu *aporte* (sueldo bruto):",
	{ capture: true },
	async (ctx, { state, fallBack, provider, gotoFlow }) => {
		if (!validarSueldo(ctx.body)) {
			await provider.sendMessage(ctx.from, "*Aporte* ingresado invalido", {
				options: null,
			});
			return fallBack();
		}
		await state.update({ sueldoTit: ctx.body });
		return gotoFlow(flowGenerarCotizacion);
	}
);

const flowMonotributoConyuge = addKeyword(EVENTS.ACTION)
	.addAction(async (ctx, { provider }) => {
		const list = {
			header: {
				type: "text",
				text: "",
			},
			body: {
				text: "*Categoria de Monotributo Esposa/Pareja*",
			},
			footer: {
				text: "",
			},
			action: {
				button: "CATEGORIAS",
				sections: [
					{
						rows: [
							{
								id: "ABC",
								title: "Categoria A - B - C",
							},
							{
								id: "D",
								title: "Categoria D",
							},
							{
								id: "E",
								title: "Categoria E",
							},
							{
								id: "F",
								title: "Categoria F",
							},
							{
								id: "G",
								title: "Categoria G",
							},
							{
								id: "H",
								title: "Categoria H",
							},
							{
								id: "I",
								title: "Categoria I",
							},
							{
								id: "J",
								title: "Categoria J",
							},
							{
								id: "K",
								title: "Categoria K",
							},
							{
								id: "Salir",
								title: "Volver al menu principal",
							},
						],
					},
				],
			},
		};
		await provider.sendList(ctx.from, list);
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (
				ctx.type !== "interactive" ||
				(ctx.body !== "ABC" &&
					ctx.body !== "D" &&
					ctx.body !== "E" &&
					ctx.body !== "F" &&
					ctx.body !== "G" &&
					ctx.body !== "H" &&
					ctx.body !== "I" &&
					ctx.body !== "J" &&
					ctx.body !== "K" &&
					ctx.body !== "Salir")
			) {
				const list = {
					header: {
						type: "text",
						text: "",
					},
					body: {
						text: "*Categoria de Monotributo Esposa/Pareja*",
					},
					footer: {
						text: "",
					},
					action: {
						button: "CATEGORIAS",
						sections: [
							{
								rows: [
									{
										id: "ABC",
										title: "Categoria A - B - C",
									},
									{
										id: "D",
										title: "Categoria D",
									},
									{
										id: "E",
										title: "Categoria E",
									},
									{
										id: "F",
										title: "Categoria F",
									},
									{
										id: "G",
										title: "Categoria G",
									},
									{
										id: "H",
										title: "Categoria H",
									},
									{
										id: "I",
										title: "Categoria I",
									},
									{
										id: "J",
										title: "Categoria J",
									},
									{
										id: "K",
										title: "Categoria K",
									},
									{
										id: "Salir",
										title: "Volver al menu principal",
									},
								],
							},
						],
					},
				};
				await provider.sendMessage(
					ctx.from,
					"*Categoria de monotributo* ingresada incorrecta. Selecciona una de las opciones validas",
					{ options: null }
				);
				await provider.sendList(ctx.from, list);
				return fallBack();
			}
			if (ctx.body === "Salir") {
				state.clear();
				return gotoFlow(flowSaludo);
			}
			await state.update({ cate_mono_cony: ctx.title_list_reply });
			let hijos = state.get("cantHijos");
			if (hijos) {
				return gotoFlow(flowHijo);
			}
			return gotoFlow(flowDataTitular);
		}
	);

const flowSueldoConyuge = addKeyword(EVENTS.ACTION).addAnswer(
	"Ingresa el *aporte* de tu *pareja/esposa* (sueldo bruto):",
	{ capture: true },
	async (ctx, { state, fallBack, provider, gotoFlow }) => {
		if (!validarSueldo(ctx.body)) {
			await provider.sendMessage(
				ctx.from,
				"*Aporte* de tu *esposa/pareja* invalido",
				{
					options: null,
				}
			);
			return fallBack();
		}
		await state.update({ sueldoCony: ctx.body });
		let hijos = state.get("cantHijos");
		if (hijos) {
			return gotoFlow(flowHijo);
		}
		return gotoFlow(flowDataTitular);
	}
);

const flowFormulario = addKeyword("Quiero ser Socio")
	.addAnswer(
		"Escribí tu *nombre* y *apellido*:",
		{ capture: true },
		async (ctx, { state, fallBack }) => {
			if (!validarNombre(ctx.body)) {
				return fallBack(
					"Nombre o Apellido invalidos (minimo 3 letras para nombre y apellido)"
				);
			} else {
				await state.update({ titular: ctx.body });
				return;
			}
		}
	)
	.addAnswer("", null, async (ctx, { provider }) => {
		const list = {
			header: {
				type: "text",
				text: "",
			},
			body: {
				text: "Seleccioná tu *Zona de Residencia*",
			},
			footer: {
				text: "",
			},
			action: {
				button: "ZONAS",
				sections: [
					{
						title: "",
						rows: [
							{
								id: "Caba",
								title: "CABA",
							},
							{
								id: "Gba Norte",
								title: "GBA Norte",
							},
							{
								id: "Gba Sur",
								title: "GBA Sur",
							},
							{
								id: "Gba Oeste",
								title: "GBA Oeste",
							},
							{
								id: "Salir",
								title: "Volver al menu principal",
							},
						],
					},
				],
			},
		};
		await provider.sendList(ctx.from, list);
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (
				ctx.type !== "interactive" ||
				(ctx.body !== "Caba" &&
					ctx.body !== "Gba Norte" &&
					ctx.body !== "Gba Sur" &&
					ctx.body !== "Gba Oeste" &&
					ctx.body !== "Salir")
			) {
				const list = {
					header: {
						type: "text",
						text: "",
					},
					body: {
						text: "Seleccioná tu *Zona de Residencia*",
					},
					footer: {
						text: "",
					},
					action: {
						button: "ZONAS",
						sections: [
							{
								title: "",
								rows: [
									{
										id: "Caba",
										title: "CABA",
									},
									{
										id: "Gba Norte",
										title: "GBA Norte",
									},
									{
										id: "Gba Sur",
										title: "GBA Sur",
									},
									{
										id: "Gba Oeste",
										title: "GBA Oeste",
									},
									{
										id: "Salir",
										title: "Volver al menu principal",
									},
								],
							},
						],
					},
				};
				await provider.sendMessage(
					ctx.from,
					"*Localidad* ingresada invalida, selecciona una de las localidades",
					{ options: null }
				);
				await provider.sendList(ctx.from, list);

				return fallBack();
			}
			if (ctx.body === "Salir") {
				state.clear();
				return gotoFlow(flowSaludo);
			}
			await state.update({ localidad: ctx.body });
			return;
		}
	)
	.addAnswer(
		"*Email* de contacto:",
		{ capture: true },
		async (ctx, { state, fallBack }) => {
			if (!validarEmail(ctx.body)) {
				return fallBack("*Email* ingresado invalido");
			}
			await state.update({ correo: ctx.body });
			return;
		}
	)
	.addAnswer(
		"¡Ya casi terminamos con el formulario! *Edad*:",
		{ capture: true },
		async (ctx, { state, fallBack }) => {
			if (!validarEdad(ctx.body, "Titular")) {
				return fallBack("*Edad* ingresada invalida, reingresa una edad valida");
			}
			await state.update({ edadTit: ctx.body });
			return;
		}
	)
	.addAnswer("", null, async (ctx, { provider }) => {
		const list = {
			header: {
				type: "text",
				text: "",
			},
			body: {
				text: "Selecciona tu *composición familiar*",
			},
			footer: {
				text: "",
			},
			action: {
				button: "COMPOSICIONES",
				sections: [
					{
						title: "Individual - Hijos",
						rows: [
							{
								id: "a",
								title: "Individual",
								description: "(Solo yo)",
							},
							{
								id: "b",
								title: "Individual + 1 Hijo/a",
							},
							{
								id: "c",
								title: "Individual + 2 Hijos",
							},
							{
								id: "d",
								title: "Individual + 3 Hijos",
							},
						],
					},
					{
						title: "Matrimonio - Pareja",
						rows: [
							{
								id: "e",
								title: "Matrimonio",
								description: "(mi pareja y yo)",
							},
							{
								id: "f",
								title: "Matrimonio + 1 Hijo/a",
								description: "(mi pareja, hijo/a, yo)",
							},
							{
								id: "g",
								title: "Matrimonio + 2 Hijos",
							},
							{
								id: "h",
								title: "Matrimonio + 3 Hijos",
							},
							{
								id: "Salir",
								title: "Volver al menu principal",
							},
						],
					},
				],
			},
		};
		await provider.sendList(ctx.from, list);
	})
	.addAction(
		{ capture: true },
		async (ctx, { state, fallBack, provider, gotoFlow }) => {
			if (
				ctx.type !== "interactive" ||
				(ctx.body !== "a" &&
					ctx.body !== "b" &&
					ctx.body !== "c" &&
					ctx.body !== "d" &&
					ctx.body !== "e" &&
					ctx.body !== "f" &&
					ctx.body !== "g" &&
					ctx.body !== "h" &&
					ctx.body !== "Salir")
			) {
				const list = {
					header: {
						type: "text",
						text: "",
					},
					body: {
						text: "Selecciona tu *composición familiar*",
					},
					footer: {
						text: "",
					},
					action: {
						button: "COMPOSICIONES",
						sections: [
							{
								title: "Individual - Hijos",
								rows: [
									{
										id: "a",
										title: "Individual",
										description: "(Solo yo)",
									},
									{
										id: "b",
										title: "Individual + 1 Hijo/a",
									},
									{
										id: "c",
										title: "Individual + 2 Hijos",
									},
									{
										id: "d",
										title: "Individual + 3 Hijos",
									},
								],
							},
							{
								title: "Matrimonio - Pareja",
								rows: [
									{
										id: "e",
										title: "Matrimonio",
										description: "(mi pareja y yo)",
									},
									{
										id: "f",
										title: "Matrimonio + 1 Hijo/a",
										description: "(mi pareja, hijo/a, yo)",
									},
									{
										id: "g",
										title: "Matrimonio + 2 Hijos",
									},
									{
										id: "h",
										title: "Matrimonio + 3 Hijos",
									},
									{
										id: "Salir",
										title: "Volver al menu principal",
									},
								],
							},
						],
					},
				};
				await provider.sendMessage(
					ctx.from,
					"Opcion de familia invalida. Seleccione una de las opciones validas",
					{ options: null }
				);
				await provider.sendList(ctx.from, list);

				return fallBack();
			}
			//await state.update({ family: ctx.title_list_reply });
			switch (ctx.body) {
				case "a":
					await state.update({ estadoTit: "Individual" });
					await state.update({ hijos: "No" });
					return gotoFlow(flowDataTitular);
				case "b":
					await state.update({ estadoTit: "Individual" });
					await state.update({ hijos: "Si" });
					await state.update({ cantHijos: "1" });
					await state.update({ edadeshijos: [] });
					return gotoFlow(flowHijo);
				case "c":
					await state.update({ estadoTit: "Individual" });
					await state.update({ hijos: "Si" });
					await state.update({ cantHijos: "2" });
					await state.update({ edadeshijos: [] });
					return gotoFlow(flowHijo);
				case "d":
					await state.update({ estadoTit: "Individual" });
					await state.update({ hijos: "Si" });
					await state.update({ cantHijos: "3" });
					await state.update({ edadeshijos: [] });
					return gotoFlow(flowHijo);
				case "e":
					await state.update({ estadoTit: "Matrimonio" });
					await state.update({ hijos: "No" });
					return gotoFlow(flowDataConyuge);
				case "f":
					await state.update({ estadoTit: "Matrimonio" });
					await state.update({ hijos: "Si" });
					await state.update({ cantHijos: "1" });
					await state.update({ edadeshijos: [] });
					return gotoFlow(flowDataConyuge);
				case "g":
					await state.update({ estadoTit: "Matrimonio" });
					await state.update({ hijos: "Si" });
					await state.update({ cantHijos: "2" });
					await state.update({ edadeshijos: [] });
					return gotoFlow(flowDataConyuge);
				case "h":
					await state.update({ estadoTit: "Matrimonio" });
					await state.update({ hijos: "Si" });
					await state.update({ cantHijos: "3" });
					await state.update({ edadeshijos: [] });
					return gotoFlow(flowDataConyuge);
				default:
					state.clear();
					return gotoFlow(flowSaludo);
			}
		}
	);

const flowSaludo = addKeyword([
	"hi",
	"hello",
	"hola",
	"ola",
	EVENTS.ACTION,
]).addAnswer(
	"¡Hola!, ¿cómo estás? 👋\nSoy el BOT Comercial de COBER | Medicina Privada 😁\nPara continuar con el procedimiento, voy a necesitar que indiques una de las siguientes opciones:",
	{
		buttons: [{ body: "Soy Socio" }, { body: "Quiero ser Socio" }],
		capture: true,
	},
	(ctx, { fallBack }) => {
		if (ctx.body != "Soy Socio" && ctx.body != "Quiero ser Socio") {
			return fallBack(
				"Error, respuesta ingresada/seleccionada incorrecta.\nSeleccione una de las siguientes opciones:"
			);
		}
		return;
	},
	[flowFormulario, flowSocio]
);

const main = async () => {
	const adapterDB = new Database();
	const adapterFlow = createFlow([
		flowSaludo,
		flowFormulario,
		flowDataTitular,
		flowDataConyuge,
		flowHijo,
		flowMonotributoTitular,
		flowSueldoTitular,
		flowMonotributoConyuge,
		flowSueldoConyuge,
		flowGenerarCotizacion,
	]);
	const adapterProvider = createProvider(Provider, {
		jwtToken: process.env.CLOUD_API_ACCESS_TOKEN,
		numberId: process.env.WA_PHONE_NUMBER_ID,
		verifyToken: process.env.WEBHOOK_VERIFICATION_TOKEN,
		version: "v20.0",
	});
	const { handleCtx, httpServer } = await createBot({
		flow: adapterFlow,
		provider: adapterProvider,
		database: adapterDB,
	});

	adapterProvider.server.post(
		"/v1/pingjoni",
		handleCtx(async (bot, req, res) => {
			try {
				const { number, name } = req.body;
				await bot.dispatch("hola", { from: number, name });
				return res.end("trigger");
			} catch (error) {
				console.log(error);
				return res.end(error);
			}
		})
	);
	adapterProvider.server.get("/ping", (bot, req, res) => {
		bot.sendMessage(process.env.PING_CEL, "pong", {
			media: null,
		});
		return res.send("pong");
	});
	adapterProvider.server.post(
		"/v1/messages",
		handleCtx(async (bot, req, res) => {
			const { number, message, urlMedia } = req.body;
			console.log(`Me pegaron con: ${number} | ${message} | ${urlMedia}`);
			await bot.sendMessage(number, message, { media: urlMedia ?? null });
			return res.end("sended");
		})
	);

	/*	adapterProvider.server.post(
		"/v1/register",
		handleCtx(async (bot, req, res) => {
			const { number, name } = req.body;
			await bot.dispatch("REGISTER_FLOW", { from: number, name });
			return res.end("trigger");
		})
	);

	adapterProvider.server.post(
		"/v1/samples",
		handleCtx(async (bot, req, res) => {
			const { number, name } = req.body;
			await bot.dispatch("SAMPLES", { from: number, name });
			return res.end("trigger");
		})
	);

	adapterProvider.server.post(
		"/v1/blacklist",
		handleCtx(async (bot, req, res) => {
			const { number, intent } = req.body;
			if (intent === "remove") bot.blacklist.remove(number);
			if (intent === "add") bot.blacklist.add(number);

			res.writeHead(200, { "Content-Type": "application/json" });
			return res.end(JSON.stringify({ status: "ok", number, intent }));
		})
	); */
	app.post(process.env.FLOW_ENDPOINT, recibirDataFlow);
	httpServer(+PORT_POLKA);
	app.listen(process.env.PORT_EXPRESS, () => {
		console.log(
			`Servidor Express Flows corriendo en el puerto ${process.env.PORT_EXPRESS}`
		);
	});
};

main();

function generateMsgsQuotes(cotizacion, form) {
	let quotesMsgs = {};
	let quotesImages = {
		classicX: {
			link: new URL("https://medicina-privada.online/planes/classic-x.png")
				.href,
		},
		oxford: {
			link: new URL("https://medicina-privada.online/planes/oxford2.png").href,
		},
		taylored: {
			link: new URL("https://medicina-privada.online/planes/taylored.png").href,
		},
		wagon: {
			link: new URL("https://medicina-privada.online/planes/wagon.png").href,
		},
		//zipper: {link: new URL("https://medicina-privada.online/planes/zipper.png").href,},
	};
	let desglose = "";
	let beneficio = "";
	let beneficioClassicX = "";
	let beneficioOxford = "";
	let beneficioTaylored = "";
	let beneficioWagon = "";
	//let beneficioZipper = "";

	if (cotizacion.titular) {
		if (cotizacion.titular.Promo) {
			beneficio = `\nPromo Ahorro ${cotizacion.titular.Promo * 100}%:`;
			beneficioClassicX = `$${parseFloat(
				cotizacion.quotePure.Classic_X * cotizacion.titular.Promo
			).toFixed(0)}`;
			beneficioOxford = `$${parseFloat(
				cotizacion.quotePure.Oxford * cotizacion.titular.Promo
			).toFixed(0)}`;
			beneficioTaylored = `$${parseFloat(
				cotizacion.quotePure.Taylored * cotizacion.titular.Promo
			).toFixed(0)}`;
			beneficioWagon = `$${parseFloat(
				cotizacion.quotePure.Wagon * cotizacion.titular.Promo
			).toFixed(0)}`;
			/* beneficioZipper = `$${parseFloat(
				cotizacion.quotePure.Zipper * cotizacion.titular.Promo
			).toFixed(0)}`; */
		}
		if (cotizacion.titular["Recibo de sueldo"]) {
			form.aporte = parseFloat(form.aporte);
			desglose = `\nAporte Titular: $${parseFloat(
				form.aporte * cotizacion.titular["Recibo de sueldo"]
			).toFixed(0)}`;
		}
		if (cotizacion.titular["Monotributo"]) {
			desglose = `\nAporte Titular: $${parseFloat(
				cotizacion.titular["Monotributo"]
			).toFixed(0)}`;
		}
		if (cotizacion.esposa) {
			if (cotizacion.esposa["Recibo de sueldo"]) {
				form.aporteConyuge = parseFloat(form.aporteConyuge);
				desglose =
					desglose +
					`\nAporte Esposa: $${parseFloat(
						form.aporteConyuge * cotizacion.esposa["Recibo de sueldo"]
					).toFixed(0)}`;
			}
			if (cotizacion.esposa["Monotributo"]) {
				desglose =
					desglose +
					`\nAporte Esposa: $${parseFloat(
						cotizacion.esposa["Monotributo"]
					).toFixed(0)}`;
			}
		}
		quotesMsgs = {
			classicX: `🟠 Plan Classic X:\nUn plan superador con una amplia cartilla médica. Encontrate con los mejores prestadores cerca tuyo.\n\nCuota Pura: ~$${cotizacion.quotePure.Classic_X}~${beneficio} ${beneficioClassicX}${desglose}\n\nCuota final por mes: *$${cotizacion.quoteDs.Classic_X}*`,
			oxford: `🟣 Plan Oxford:\nEquilibrio justo entre cobertura y prestadores. Seleccionamos lo mejor y armamos un plan 100% hecho para vos.\n\nCuota Pura: ~$${cotizacion.quotePure.Oxford}~${beneficio} ${beneficioOxford}${desglose}\n\nCuota final por mes: *$${cotizacion.quoteDs.Oxford}*`,
			taylored: `🟤 Plan Taylored:\nUn plan de primer nivel. Los mejores especialistas, sanatorios, clínicas y centros médicos siempre a tu disposición.\n\nCuota Pura: ~$${cotizacion.quotePure.Taylored}~${beneficio} ${beneficioTaylored}${desglose}\n\nCuota final por mes: *$${cotizacion.quoteDs.Taylored}*`,
			wagon: `🔵 Plan Wagon:\nCartilla médica premium, atención personalizada 24/7 y la más amplia cobertura prestacional. Gestioná tu cobertura 100% online.\n\nCuota Pura: ~$${cotizacion.quotePure.Wagon}~${beneficio} ${beneficioWagon}${desglose}\n\nCuota final por mes: *$${cotizacion.quoteDs.Wagon}*`,
			//zipper: `🟣 Plan Zipper:\nEl plan accesible que cubre todo lo que necesitás y más.\n\nCuota Pura: ~$${cotizacion.quotePure.Zipper}~${beneficio} ${beneficioZipper}${desglose}\n\nCuota final por mes: *$${cotizacion.quoteDs.Zipper}*`,
		};
	}
	return { quotesMsgs, quotesImages };
}
