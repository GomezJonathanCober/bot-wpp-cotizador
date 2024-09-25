import { obtenerFechaHora } from "../utils/functions.js";

export function dataToSheet(data) {
	let formData = {
		writeRow: "Lead",
		nombre: data.titular,
		edad: data.edadTit,
		contratacion: data.tipoAfiTit,
		categoriaMonotributo: data.cate_mono_tit || "-",
		aporte: data.sueldoTit || "-",
		familia: data.estadoTit,
		edadConyuge: data.edadCony || "-",
		contratacionConyuge: data.tipoAfiCony || "-",
		categoriaMonotributoConyuge: data.cate_mono_cony || "-",
		aporteConyuge: data.sueldoCony || "-",
		hijos: data.hijos,
		edadHijo1: "-",
		edadHijo2: "-",
		edadHijo3: "-",
		cel: data.cel,
		email: data.correo,
		localidad: data.localidad,
		fecha: obtenerFechaHora(),
	};

	if (data?.edadeshijos && Array.isArray(data.edadeshijos)) {
		if (data?.edadeshijos?.[0]?.edad_hijo) {
			formData.edadHijo1 = data.edadeshijos[0].edad_hijo;
		}
		if (data?.edadeshijos?.[1]?.edad_hijo) {
			formData.edadHijo2 = data.edadeshijos[1].edad_hijo;
		}
		if (data?.edadeshijos?.[2]?.edad_hijo) {
			formData.edadHijo3 = data.edadeshijos[2].edad_hijo;
		}
	}
	return formData;
}
