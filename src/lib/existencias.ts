import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";

/**
 * Existencias por producto (huevos para cubetas, unidades para gallinas).
 * Se leen de Producto.existencias, que se mantiene al día con cada movimiento.
 */
export async function existencias(cliente: Tx | typeof db = db): Promise<Map<number, number>> {
  const filas = await cliente.producto.findMany({ select: { id: true, existencias: true } });
  return new Map(filas.map((f) => [f.id, f.existencias]));
}

function ordenados(ids: Iterable<number>): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Bloquea dentro de la transacción solo los productos indicados y devuelve sus existencias.
 * Dos entregas de productos distintos no se esperan entre sí; dos del mismo producto sí,
 * para no vender la misma mercancía. Se bloquea en orden de id para evitar bloqueos cruzados.
 */
export async function bloquearExistencias(tx: Tx, productoIds: Iterable<number>): Promise<Map<number, number>> {
  const ids = ordenados(productoIds);
  const filas = await tx.$queryRaw<{ id: number; existencias: number }[]>`
    SELECT "id", "existencias" FROM "Producto" WHERE "id" = ANY(${ids}::int[]) ORDER BY "id" FOR UPDATE`;
  return new Map(filas.map((f) => [f.id, f.existencias]));
}

/** Toda entrada o salida de inventario pasa por aquí: guarda los movimientos y actualiza las existencias. */
export async function registrarMovimientos(tx: Tx, movimientos: Prisma.MovimientoInventarioCreateManyInput[]) {
  const creados = await tx.movimientoInventario.createManyAndReturn({ data: movimientos });
  const cambios = new Map<number, number>();
  for (const m of movimientos) cambios.set(m.productoId, (cambios.get(m.productoId) ?? 0) + m.cantidad);
  for (const id of ordenados(cambios.keys())) {
    await tx.producto.update({ where: { id }, data: { existencias: { increment: cambios.get(id)! } } });
  }
  return creados;
}

/** Bloqueo para que dos operaciones simultáneas no apliquen dos veces el mismo saldo. */
const BLOQUEO_CLIENTE = 2;

export async function bloquearCliente(tx: Tx, clienteId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BLOQUEO_CLIENTE}::int, ${clienteId}::int)`;
}
