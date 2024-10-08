import { convertCurrencyStringToNumber } from "../utils/functions.js";

export async function getQuote(rowNumber, form) {
	const cotizadorUrl = new URL(process.env.COTIZADOR_URI);
	await new Promise((resolve) => setTimeout(resolve, 3000));

	let requestOptions = {
		method: "GET",
		redirect: "follow",
	};
	let params = new URLSearchParams();
	params.append("row", rowNumber);
	cotizadorUrl.search = params.toString();
	let response = await fetch(cotizadorUrl.toString(), requestOptions);
	let responseJson = await response.json();
	if (responseJson.error) {
		console.log("Error:", responseJson.error);
		return null;
	}

	let cotizacion = {
		quotePure: {
			Classic_X: convertCurrencyStringToNumber(responseJson.sDs.classic),
			Oxford: convertCurrencyStringToNumber(responseJson.sDs.oxford),
			Taylored: convertCurrencyStringToNumber(responseJson.sDs.taylored),
			Wagon: convertCurrencyStringToNumber(responseJson.sDs.wagon),
			//Zipper: convertCurrencyStringToNumber(responseJson.sDs.zipper),
		},
		quoteDs: {
			Classic_X: convertCurrencyStringToNumber(responseJson.withDs.classic),
			Oxford: convertCurrencyStringToNumber(responseJson.withDs.oxford),
			Taylored: convertCurrencyStringToNumber(responseJson.withDs.taylored),
			Wagon: convertCurrencyStringToNumber(responseJson.withDs.wagon),
			//Zipper: convertCurrencyStringToNumber(responseJson.withDs.zipper),
		},
		titular: {},
	};
	if (form.edad) {
		if (parseInt(form.edad) <= 60) {
			cotizacion.titular = {
				Promo: await getDiscount("Promo"),
			};
		}
	}
	if (form.contratacion !== "Particular") {
		if (form.contratacion === "Monotributo") {
			cotizacion.titular["Monotributo"] = await getDiscount(
				form.categoriaMonotributo
			);
		} else {
			cotizacion.titular[form.contratacion] = await getDiscount(
				form.contratacion
			);
		}
	}

	if (form.familia === "Matrimonio") {
		cotizacion.esposa = {};
		cotizacion.esposa = {
			Promo: await getDiscount("Promo"),
		};
		if (form.contratacionConyuge !== "Particular") {
			if (form.contratacionConyuge === "Monotributo") {
				cotizacion.esposa["Monotributo"] = await getDiscount(
					form.categoriaMonotributoConyuge
				);
			} else {
				cotizacion.esposa[form.contratacionConyuge] = await getDiscount(
					form.contratacionConyuge
				);
			}
		}
	}
	return cotizacion;
}

async function getDiscount(ds) {
	const cotizadorUrl = new URL(process.env.COTIZADOR_URI);
	//console.log("Buscar Descuento:", ds);
	let requestOptions = {
		method: "GET",
		redirect: "follow",
	};
	let params = new URLSearchParams();
	params.append("discount", ds);
	cotizadorUrl.search = params.toString();
	let response = await fetch(cotizadorUrl.toString(), requestOptions);
	let responseJson = await response.json();
	if (responseJson.error) {
		console.error("Error:", responseJson.error);
		return null;
	}
	return responseJson.ds;
}
