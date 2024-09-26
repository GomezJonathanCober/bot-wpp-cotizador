export async function registrarPoliza(data) {
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
			process.env.URI_API_CREAR_POLIZA,
			requestOptions
		);

		if (!response.ok) {
			throw new Error("La solicitud no fue exitosa");
		}

		const responseJson = await response.json();
		console.log("Nueva Poliza:", responseJson);
		return responseJson;
	} catch (error) {
		console.error("Error al realizar la solicitud:", error);
		throw error;
	}
}
