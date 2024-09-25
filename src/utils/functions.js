export function pausa(ms) {
	//console.log(`Esperando en pausa ${ms / 1000} segundos`);
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function obtenerFechaHora() {
	const ahora = new Date();
	const opciones = {
		timeZone: "America/Argentina/Buenos_Aires",
		hour12: false,
	};
	const fechaHora = ahora.toLocaleString("es-AR", opciones);
	return fechaHora.replace(",", "");
}

export function convertCurrencyStringToNumber(input) {
	// Eliminar caracteres como signos de dólar y porcentajes, y reemplazar comas por puntos
	if (typeof input === "string") {
		let numeroLimpio = input.replace(/[^0-9,.-]+/g, "").replace(",", "");
		// Convertir a número con parseFloat para mantener decimales
		let numero = parseFloat(numeroLimpio).toFixed(0);
		return numero;
	}
	if (typeof input === "number") {
		let numero = parseFloat(input).toFixed(0);
		return numero;
	}
}
