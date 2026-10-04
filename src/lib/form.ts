// Utilidades para leer formularios en las acciones del servidor.

export type EstadoForm = { error?: string; ok?: string } | undefined;

export function texto(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

export function textoOpcional(form: FormData, campo: string): string | null {
  return texto(form, campo) || null;
}

/** Entero no negativo; acepta "15.000" o "15000". Devuelve null si está vacío. */
export function entero(form: FormData, campo: string): number | null {
  const v = texto(form, campo).replace(/[.\s$]/g, "");
  if (v === "") return null;
  if (!/^\d+$/.test(v)) throw new ErrorUsuario(`"${campo}" debe ser un número entero.`);
  return Number(v);
}

/** Error con mensaje para mostrar al usuario. */
export class ErrorUsuario extends Error {}

export function mensajeError(e: unknown): string {
  if (e instanceof ErrorUsuario) return e.message;
  console.error(e);
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}
