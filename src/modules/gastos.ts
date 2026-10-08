// Lo que la empresa compra o paga para el negocio, para elegirlo de una lista en "Gasto o retiro".
// "Otro" deja escribir el concepto a mano.
export const CONCEPTOS_GASTO = [
  "Aceite moto",
  "Arreglos general moto",
  "Bolsas",
  "Calcio",
  "Calculadora",
  "Copias",
  "Cubetas",
  "Cuaderno",
  "Cuido",
  "Escoba",
  "Esponjas",
  "Gallinaza",
  "Gasolina",
  "Guantes",
  "Jabón",
  "Lapicero",
  "Lápiz",
  "Limpido",
  "Materiales galpones",
  "Nómina",
  "Pagos ayudante",
  "Papel higiénico",
  "Pilas",
  "Pipeta gas",
  "Pita",
  "Plan celulares",
  "Recogedor",
  "Resaltador",
  "Sacapuntas",
  "Seguro Johan",
  "Servicios",
  "Stickers cubetas",
  "Tapabocas",
  "Tijeras",
  "Toalla huevos",
  "Trapera",
  "Vitaminas",
] as const;

export const OTRO_GASTO = "OTRO";

/** El concepto que se guarda: el de la lista, o el que se escribió si se eligió Otro. Null si falta. */
export function conceptoGasto(elegido: string, escrito: string): string | null {
  if (elegido === OTRO_GASTO) return escrito.trim() || null;
  return (CONCEPTOS_GASTO as readonly string[]).includes(elegido) ? elegido : null;
}
