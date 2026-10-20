// Pedidos recurrentes: se repiten cada semana en los días elegidos (0 domingo ... 6 sábado).

/** Días en el orden en que se muestran: la semana empieza el lunes. */
export const DIAS_SEMANA = [
  { valor: 1, nombre: "lunes" },
  { valor: 2, nombre: "martes" },
  { valor: 3, nombre: "miércoles" },
  { valor: 4, nombre: "jueves" },
  { valor: 5, nombre: "viernes" },
  { valor: 6, nombre: "sábado" },
  { valor: 0, nombre: "domingo" },
] as const;

/** Día de la semana de una fecha guardada a medianoche UTC. */
export function diaDeLaSemana(dia: Date): number {
  return dia.getUTCDay();
}

/** Toca generar el pedido ese día: está entre sus días de la semana y no es antes de que empiece. */
export function tocaElDia(recurrente: { diasSemana: number[]; desde: Date }, dia: Date): boolean {
  return dia >= recurrente.desde && recurrente.diasSemana.includes(diaDeLaSemana(dia));
}

/** Días válidos, sin repetir y en el orden de la semana. */
export function normalizarDias(dias: number[]): number[] {
  return DIAS_SEMANA.map((d) => d.valor).filter((v) => dias.includes(v));
}

/** "todos los días", "lunes", "lunes y jueves", "lunes, miércoles y viernes". */
export function textoDias(dias: number[]): string {
  const nombres = DIAS_SEMANA.filter((d) => dias.includes(d.valor)).map((d) => d.nombre);
  if (nombres.length === 7) return "todos los días";
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
