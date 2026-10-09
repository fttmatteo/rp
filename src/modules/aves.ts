// Conteo de aves, edad y porcentaje de postura. En pantalla solo se habla de galpones: cada entrada de aves a un
// galpón es un grupo de aves (a lo sumo uno activo por galpón) que queda como historial cuando salen todas.

export type TipoNovedad = "MUERTE" | "DESCARTE" | "VENTA" | "TRASLADO";

export interface Novedad {
  grupoId: number;
  grupoDestinoId: number | null;
  tipo: TipoNovedad;
  cantidad: number;
  fecha: Date;
  anulada: boolean;
}

/** Cuánto cambia el conteo de un grupo por una novedad: salen del origen y entran al destino si es traslado. */
export function efectoEnGrupo(n: Novedad, grupoId: number): number {
  if (n.anulada) return 0;
  if (n.grupoId === grupoId) return -n.cantidad;
  if (n.tipo === "TRASLADO" && n.grupoDestinoId === grupoId) return n.cantidad;
  return 0;
}

/** Aves vivas = inicial − muertes − descartes − vendidas ± traslados (hasta una fecha, si se indica). */
export function avesVivas(grupo: { id: number; cantidadInicial: number }, novedades: Novedad[], hasta?: Date): number {
  return novedades.filter((n) => !hasta || n.fecha <= hasta).reduce((total, n) => total + efectoEnGrupo(n, grupo.id), grupo.cantidadInicial);
}

/** Aves que entraron al grupo: las iniciales más las que llegaron por traslado (sin anuladas). */
export function avesQueEntraron(grupo: { id: number; cantidadInicial: number }, novedades: Novedad[]): number {
  return novedades.reduce((s, n) => (!n.anulada && n.tipo === "TRASLADO" && n.grupoDestinoId === grupo.id ? s + n.cantidad : s), grupo.cantidadInicial);
}

/** Edad del grupo en semanas cumplidas a una fecha. */
export function edadSemanas(fechaIngreso: Date, edadIngresoSemanas: number, hoy: Date): number {
  const dias = Math.floor((hoy.getTime() - fechaIngreso.getTime()) / 86_400_000);
  return edadIngresoSemanas + Math.max(0, Math.floor(dias / 7));
}

/** % de postura = huevos del día ÷ aves vivas, con un decimal. Null si no hay aves. */
export function porcentajePostura(huevos: number, aves: number): number | null {
  if (aves <= 0) return null;
  return Math.round((huevos / aves) * 1000) / 10;
}

/** Suma de novedades por tipo (para el reporte de mortalidad). Los traslados no cuentan como bajas. */
export function bajasPorTipo(novedades: Novedad[]): Record<Exclude<TipoNovedad, "TRASLADO">, number> {
  const r = { MUERTE: 0, DESCARTE: 0, VENTA: 0 };
  for (const n of novedades) if (!n.anulada && n.tipo !== "TRASLADO") r[n.tipo] += n.cantidad;
  return r;
}
