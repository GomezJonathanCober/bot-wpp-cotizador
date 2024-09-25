export async function updateCell(rowNumber, column, msg) {
	const cotizadorUrl = new URL(process.env.COTIZADOR_URI);
	const myHeaders = new Headers();
	myHeaders.append("Content-Type", "application/json");

	const raw = JSON.stringify({
		updateCell: msg,
		row: rowNumber,
		column: column,
	});

	const requestOptions = {
		method: "POST",
		headers: myHeaders,
		body: raw,
		redirect: "follow",
	};

	let response = await fetch(cotizadorUrl.toString(), requestOptions);
	let responseJson = await response.json();
	if (responseJson.error) {
		console.log(responseJson.error);
	}
	console.log(`${responseJson.msg}`);
}
