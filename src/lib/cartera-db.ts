import { db, type Tx } from "@/lib/db";

type Cliente = Tx | typeof db;

const PENDIENTE = { anulada: false, saldo: { gt: 0 } } as const;

/** Lo que debe un cliente en total. */
export async function saldoCliente(clienteId: number, c: Cliente = db): Promise<number> {
  const r = await c.venta.aggregate({ where: { clienteId, ...PENDIENTE }, _sum: { saldo: true } });
  return r._sum.saldo ?? 0;
}

/** Saldo de cada cliente que debe algo. */
export async function saldosPorCliente(clienteIds?: number[]): Promise<Map<number, number>> {
  const filas = await db.venta.groupBy({
    by: ["clienteId"],
    where: { ...PENDIENTE, ...(clienteIds ? { clienteId: { in: clienteIds } } : {}) },
    _sum: { saldo: true },
  });
  return new Map(filas.map((f) => [f.clienteId, f._sum.saldo ?? 0]));
}

/** Ventas con saldo pendiente, de la más antigua a la más reciente. */
export async function deudasPendientes(clienteId: number, c: Cliente = db) {
  return c.venta.findMany({ where: { clienteId, ...PENDIENTE }, orderBy: [{ fecha: "asc" }, { id: "asc" }] });
}
