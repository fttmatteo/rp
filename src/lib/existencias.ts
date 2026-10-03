import { db, type Tx } from "@/lib/db";

/** Existencias por producto (huevos para cubetas, unidades para gallinas). */
export async function existencias(cliente: Tx | typeof db = db): Promise<Map<number, number>> {
  const filas = await cliente.movimientoInventario.groupBy({ by: ["productoId"], _sum: { cantidad: true } });
  return new Map(filas.map((f) => [f.productoId, f._sum.cantidad ?? 0]));
}

/**
 * Bloqueos dentro de una transacción para que dos operaciones simultáneas
 * no vendan la misma mercancía ni apliquen dos veces el mismo saldo.
 */
const BLOQUEO_INVENTARIO = 1;
const BLOQUEO_CLIENTE = 2;

export async function bloquearInventario(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BLOQUEO_INVENTARIO}::int, 0)`;
}

export async function bloquearCliente(tx: Tx, clienteId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BLOQUEO_CLIENTE}::int, ${clienteId}::int)`;
}
