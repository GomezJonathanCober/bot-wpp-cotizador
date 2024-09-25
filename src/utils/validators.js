export function validarNombre(nombreCompleto) {
	let nombreRegex = /^[a-zA-ZÁÉÍÓÚáéíóú]{3,}$/;
	let apellidoRegex = /^[a-zA-ZÁÉÍÓÚáéíóú]{3,}$/;

	// Convertir el texto a minúsculas
	nombreCompleto = nombreCompleto.toLowerCase();

	// Separar el nombre y el apellido por el espacio
	let partes = nombreCompleto.split(" ");

	// Verificar si hay dos partes (nombre y apellido)
	if (partes.length === 2) {
		let nombre = partes[0];
		let apellido = partes[1];

		// Validar el nombre y el apellido con las expresiones regulares
		if (nombreRegex.test(nombre) && apellidoRegex.test(apellido)) {
			return true;
		}
	} else if (partes.length === 3) {
		let nombre = partes[0];
		let segundoNombre = partes[1];
		let apellido = partes[2];

		// Validar el nombre y el apellido con las expresiones regulares
		if (
			nombreRegex.test(nombre) &&
			nombreRegex.test(segundoNombre) &&
			apellidoRegex.test(apellido)
		) {
			return true;
		}
	}
	return false;
}

export function validarEmail(email) {
	let emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
	return emailRegex.test(email);
}

export function validarEdad(edad, tipo) {
	let ageRegex = /^[0-9]{1,2}( años)?$/;
	let msgLower = edad.toLowerCase();
	if (ageRegex.test(msgLower)) {
		// Si el mensaje contiene " años", lo eliminamos antes de convertirlo a número
		if (msgLower.includes(" años")) {
			msgLower = msgLower.replace(" años", "");
		}
		// Convertimos el mensaje a un número entero
		let ageInt = parseInt(msgLower, 10);
		let edadMax = 0;
		let edadMin = 0;
		if (tipo === "Titular" || tipo === "Esposa") {
			edadMax = 65;
			edadMin = 18;
		}
		if (tipo === "Hijo") {
			edadMax = 30;
			edadMin = 0;
		}
		// Verificamos si la edad está en el rango de edadMin a edadMax
		if (ageInt >= edadMin && ageInt <= edadMax) {
			return true;
		}
	}
	return false;
}

export function validarSueldo(sueldo) {
	let contribution = parseInt(sueldo, 10);
	if (contribution <= 0) {
		return false;
	}
	return true;
}
