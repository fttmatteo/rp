// Rangos de peso (gramos por huevo) de cada tipo de huevo. Un límite vacío (null) significa sin límite.

export interface RangoGramos {
  nombre: string;
  gramosMin: number | null;
  gramosMax: number | null;
}

// Texto corto para mostrar el rango: "60 a 66 g", "78 g o más", "hasta 44 g". Null si no tiene rango.
export function textoRangoGramos(r: Pick<RangoGramos, "gramosMin" | "gramosMax">): string | null {
  const { gramosMin: min, gramosMax: max } = r;
  if (min === null && max === null) return null;
  if (min === null) return `hasta ${max} g`;
  if (max === null) return `${min} g o más`;
  return min === max ? `${min} g` : `${min} a ${max} g`;
}

// Primer par de tipos cuyos rangos se cruzan (un mismo peso caería en los dos). Los tipos sin rango no cuentan.
export function rangosCruzados(rangos: RangoGramos[]): [string, string] | null {
  const conRango = rangos.filter((r) => r.gramosMin !== null || r.gramosMax !== null);
  for (let i = 0; i < conRango.length; i++) {
    for (let j = i + 1; j < conRango.length; j++) {
      const a = conRango[i];
      const b = conRango[j];
      const desdeA = a.gramosMin ?? 0;
      const hastaA = a.gramosMax ?? Infinity;
      const desdeB = b.gramosMin ?? 0;
      const hastaB = b.gramosMax ?? Infinity;
      if (desdeA <= hastaB && desdeB <= hastaA) return [a.nombre, b.nombre];
    }
  }
  return null;
}
