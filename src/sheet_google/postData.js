export async function writeRowInSheet(values) {
	values.writeRow = true;
	const cotizadorUrl = new URL(process.env.COTIZADOR_URI);
	const myHeaders = new Headers();
	myHeaders.append("Content-Type", "application/json");
	const body = JSON.stringify(values);
	const requestOptions = {
		method: "POST",
		headers: myHeaders,
		body: body,
		redirect: "follow",
	};
	let response = await fetch(cotizadorUrl.toString(), requestOptions);
	let responseJson = await response.json();
	if (responseJson.error) {
		console.log("Error:", responseJson.error);
		return null;
	}
	console.log("Se escribio en fila:", responseJson.row);
	return responseJson.row;
}
