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

export interface DeudaCliente {
  saldo: number;
  vencido: number;
  masAntigua: Date | null;
  deudas: { id: number; consecutivo: number; fecha: Date; vence: Date; saldo: number }[];
}

/** Deudas pendientes de varios clientes a la vez (para la ruta del repartidor). */
export async function deudasDeClientes(clienteIds: number[], hoy: Date): Promise<Map<number, DeudaCliente>> {
  const ventas = await db.venta.findMany({
    where: { clienteId: { in: clienteIds }, ...PENDIENTE },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    select: { id: true, clienteId: true, consecutivo: true, fecha: true, vence: true, saldo: true },
  });
  const resultado = new Map<number, DeudaCliente>();
  for (const v of ventas) {
    const d = resultado.get(v.clienteId) ?? { saldo: 0, vencido: 0, masAntigua: null, deudas: [] };
    d.saldo += v.saldo;
    if (v.vence < hoy) d.vencido += v.saldo;
    d.masAntigua ??= v.fecha;
    d.deudas.push(v);
    resultado.set(v.clienteId, d);
  }
  return resultado;
}
