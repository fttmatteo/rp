// Reglas de las rutas de entrega: orden de las paradas, cantidades entregadas y liquidación.
import { ErrorUsuario } from "@/lib/form";
import type { PagoEntrega } from "./reparto";

export interface Parada {
  id: number;
  zona: string | null;
  direccion: string | null;
  cliente: string;
  orden: number | null;
}

const comparar = (a: string | null, b: string | null) => {
  // Las paradas sin zona o dirección van al final.
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
};

/** Agrupa las paradas por zona o barrio y, dentro de cada zona, por dirección y cliente. Devuelve los ids en orden. */
export function ordenarPorZona(paradas: Parada[]): number[] {
  return [...paradas]
    .sort((a, b) => comparar(a.zona, b.zona) || comparar(a.direccion, b.direccion) || comparar(a.cliente, b.cliente) || a.id - b.id)
    .map((p) => p.id);
}

/**
 * Orden escrito a mano: cada parada con su número (vacío = se deja donde estaba).
 * Devuelve los ids en el nuevo orden, numerados de nuevo desde 1 sin huecos.
 */
export function ordenManual(paradas: Parada[], numeros: ReadonlyMap<number, number | null>): number[] {
  const actual = [...paradas].sort((a, b) => (a.orden ?? Infinity) - (b.orden ?? Infinity) || a.id - b.id);
  const posicion = new Map(actual.map((p, i) => [p.id, i + 1]));
  return actual
    .map((p) => ({ id: p.id, clave: numeros.get(p.id) ?? posicion.get(p.id)!, antes: posicion.get(p.id)! }))
    .sort((a, b) => a.clave - b.clave || a.antes - b.antes)
    .map((p) => p.id);
}

/** Valida lo entregado de cada línea: entre 0 y lo pedido, y al menos algo en total. */
export function validarEntregadas(
  lineas: { id: number; cantidad: number; nombre: string }[],
  entregadas: ReadonlyMap<number, number | null>,
): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const l of lineas) {
    const n = entregadas.get(l.id) ?? l.cantidad;
    if (n > l.cantidad) throw new ErrorUsuario(`${l.nombre}: no se puede entregar más de lo pedido (${l.cantidad}).`);
    resultado.set(l.id, n);
  }
  if ([...resultado.values()].every((n) => n === 0))
    throw new ErrorUsuario("No se entregó nada. Usa «No se entregó» para dejar el pedido como no entregado.");
  return resultado;
}

export interface Liquidacion {
  cobradoEfectivo: number;
  cobradoTransferencia: number;
  // Lo cobrado en la ruta que no fue de las entregas: abonos a deudas anteriores.
  abonosEfectivo: number;
  abonosTransferencia: number;
  // Efectivo que el repartidor debe entregar en caja.
  efectivoEsperado: number;
}

/**
 * Liquidación de una ruta a partir de todos los pagos que cobró el repartidor en ella
 * y de la parte de esos pagos que se aplicó a las ventas entregadas.
 */
export function liquidarRuta(pagosRuta: PagoEntrega[], pagadoEntregas: { efectivo: number; transferencia: number }): Liquidacion {
  const suma = (medio: PagoEntrega["medio"]) => pagosRuta.filter((p) => p.medio === medio).reduce((s, p) => s + p.valor, 0);
  const cobradoEfectivo = suma("EFECTIVO");
  const cobradoTransferencia = suma("TRANSFERENCIA");
  return {
    cobradoEfectivo,
    cobradoTransferencia,
    abonosEfectivo: cobradoEfectivo - pagadoEntregas.efectivo,
    abonosTransferencia: cobradoTransferencia - pagadoEntregas.transferencia,
    efectivoEsperado: cobradoEfectivo,
  };
}
