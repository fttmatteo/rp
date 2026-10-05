// Utilidades para leer formularios en las acciones del servidor.

export type EstadoForm = { error?: string; ok?: string } | undefined;

export function texto(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

export function textoOpcional(form: FormData, campo: string): string | null {
  return texto(form, campo) || null;
}

// Tope para que un número enorme no desborde las columnas Int de PostgreSQL.
const MAXIMO = 1_000_000_000;

/**
 * Entero no negativo; acepta "15.000" o "15000". Devuelve null si está vacío.
 * `etiqueta` es el nombre que ve el usuario en el mensaje de error (no el nombre interno del campo).
 */
export function entero(form: FormData, campo: string, etiqueta: string): number | null {
  const v = texto(form, campo).replace(/[.\s$]/g, "");
  if (v === "") return null;
  if (!/^\d+$/.test(v)) throw new ErrorUsuario(`${etiqueta}: escribe solo números enteros, sin letras ni decimales.`);
  const n = Number(v);
  if (n > MAXIMO) throw new ErrorUsuario(`${etiqueta}: el número es demasiado grande.`);
  return n;
}

/** Número con decimales (acepta coma o punto), dentro de un rango. Devuelve null si está vacío. */
export function decimal(form: FormData, campo: string, etiqueta: string, min: number, max: number): number | null {
  const v = texto(form, campo).replace(",", ".");
  if (v === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new ErrorUsuario(`${etiqueta}: escribe un número, por ejemplo 4.6097.`);
  const n = Number(v);
  if (n < min || n > max) throw new ErrorUsuario(`${etiqueta}: debe estar entre ${min} y ${max}.`);
  return n;
}

/** Error con mensaje para mostrar al usuario. */
export class ErrorUsuario extends Error {}

// Errores de Prisma que el usuario puede entender. Se reconocen por código o nombre
// para no importar Prisma aquí (este archivo también lo usan los módulos puros).
const ERRORES_BD: Record<string, string> = {
  P2025: "Ese registro ya no existe. Recarga la página.",
  P2002: "Ya existe un registro con esos datos.",
  P2034: "Otra persona estaba guardando lo mismo al tiempo. Intenta de nuevo.",
  P2028: "La operación tardó demasiado. Intenta de nuevo.",
  P1001: "No hay conexión con la base de datos. Revisa la conexión e intenta de nuevo.",
  P1002: "No hay conexión con la base de datos. Revisa la conexión e intenta de nuevo.",
  P1017: "Se perdió la conexión con la base de datos. Intenta de nuevo.",
};

export function mensajeError(e: unknown): string {
  if (e instanceof ErrorUsuario) return e.message;
  console.error(e);
  const error = e as { code?: unknown; name?: unknown } | null;
  if (error && typeof error.code === "string" && ERRORES_BD[error.code]) return ERRORES_BD[error.code];
  if (error?.name === "PrismaClientInitializationError") return ERRORES_BD.P1001;
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}
