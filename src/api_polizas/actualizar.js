export async function actualizarPoliza(data, userId) {
	//console.log("Entre a actualizar la poliza");
	const myHeaders = new Headers();
	myHeaders.append("Content-Type", "application/json");

	const requestOptions = {
		method: "POST",
		headers: myHeaders,
		body: JSON.stringify(data),
		redirect: "follow",
	};

	try {
		const response = await fetch(
			process.env.URI_API_ACTUALIZAR_POLIZA,
			requestOptions
		);

		if (!response.ok) {
			throw new Error("La solicitud no fue exitosa");
		}

		const responseJson = await response.json();
		//console.log("Actualizar Poliza:", responseJson);
		await new Promise((resolve) => setTimeout(resolve, 3000));
		console.log("Enviar pdf a:", userId);
		const sendPdf = await fetch(
			`https://${process.env.DOMINIO_PROD}/v1/messages`,
			{
				method: "POST",
				headers: myHeaders,
				body: JSON.stringify({
					number: userId,
					message: "Su solicitud",
					urlMedia: responseJson.URL,
				}),
			}
		);
		const sendpdfjson = await sendPdf.text();
		//console.log("SendPDF:", sendpdfjson);
		return responseJson;
	} catch (error) {
		console.error("Error al realizar la solicitud:", error);
		throw error;
	}
}
