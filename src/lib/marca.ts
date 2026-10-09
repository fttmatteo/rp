// Dos identidades distintas: el software (RP Software, de su autor) y la empresa que lo usa.
// Lo que sale de la empresa hacia sus clientes (recibos, reportes, el encabezado de la app) lleva el nombre de la
// empresa; el software solo firma con un crédito pequeño y conserva lo suyo (ícono de la app, "Acerca de", pie).

export const NOMBRE_SOFTWARE = "RP Software";

/** Crédito del software al pie de recibos y reportes. */
export const CREDITO_DOCUMENTOS = `Generado con ${NOMBRE_SOFTWARE}`;

/**
 * Nombre de la empresa que usa el software, de la variable EMPRESA_NOMBRE del servidor (en producción es
 * obligatoria). Vacío si no está configurada; solo se lee en el servidor.
 */
export function nombreEmpresa(): string {
  return process.env.EMPRESA_NOMBRE?.trim() ?? "";
}
