import { HUEVOS_POR_CUBETA } from "@/lib/formato";

// El inventario de huevos se guarda en huevos; los pedidos se hacen en cubetas.

export function unidadesInventario(tipo: "CUBETA" | "GALLINA" | "GALLINAZA", cantidadVendida: number): number {
  return tipo === "CUBETA" ? cantidadVendida * HUEVOS_POR_CUBETA : cantidadVendida;
}

export function huevosDe(cubetas: number, sueltos: number): number {
  return cubetas * HUEVOS_POR_CUBETA + sueltos;
}

export interface Faltante {
  productoId: number;
  disponible: number;
  requerido: number;
}

/** Devuelve los productos sin existencias suficientes para una entrega. */
export function faltantes(
  requeridos: { productoId: number; unidades: number }[],
  existencias: ReadonlyMap<number, number>,
): Faltante[] {
  const porProducto = new Map<number, number>();
  for (const r of requeridos) porProducto.set(r.productoId, (porProducto.get(r.productoId) ?? 0) + r.unidades);
  const resultado: Faltante[] = [];
  for (const [productoId, requerido] of porProducto) {
    const disponible = existencias.get(productoId) ?? 0;
    if (disponible < requerido) resultado.push({ productoId, disponible, requerido });
  }
  return resultado;
}
