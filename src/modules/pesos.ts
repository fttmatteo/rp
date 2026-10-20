// Rangos de peso (gramos por huevo) de cada tipo de huevo. Un límite vacío (null) significa sin límite.
// Los rangos de dos tipos pueden cruzarse: el administrador decide.

// Texto corto para mostrar el rango: "60 a 66 g", "78 g o más", "hasta 44 g". Null si no tiene rango.
export function textoRangoGramos(r: { gramosMin: number | null; gramosMax: number | null }): string | null {
  const { gramosMin: min, gramosMax: max } = r;
  if (min === null && max === null) return null;
  if (min === null) return `hasta ${max} g`;
  if (max === null) return `${min} g o más`;
  return min === max ? `${min} g` : `${min} a ${max} g`;
}
