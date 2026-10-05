import "server-only";
import { exigirCajaAbierta, exigirEfectivo } from "@/lib/caja-db";
import { db, type Tx } from "@/lib/db";
import { diaUTC, hoyISO } from "@/lib/formato";
import type { Medio } from "@/lib/pagos";
import { aplicarPagoARecibo, aplicarPagoFIFO } from "@/modules/cartera";

type Cliente = Tx | typeof db;
const PENDIENTE = { anulada: false, saldo: { gt: 0 } } as const;

/** Cuentas por pagar de un proveedor, de la más antigua a la más reciente. */
export async function comprasPorPagar(proveedorId: number, c: Cliente = db) {
  return c.compra.findMany({ where: { proveedorId, ...PENDIENTE }, orderBy: [{ fecha: "asc" }, { id: "asc" }] });
}

export async function saldosProveedores(): Promise<Map<number, number>> {
  const filas = await db.compra.groupBy({ by: ["proveedorId"], where: PENDIENTE, _sum: { saldo: true } });
  return new Map(filas.map((f) => [f.proveedorId, f._sum.saldo ?? 0]));
}

const BLOQUEO_PROVEEDOR = 4;

export async function bloquearProveedor(tx: Tx, proveedorId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BLOQUEO_PROVEEDOR}::int, ${proveedorId}::int)`;
}

/** Saca de la caja de hoy un pago a un proveedor (efectivo o transferencia). */
export async function egresoProveedor(
  tx: Tx,
  d: { valor: number; medio: Medio; concepto: string; usuarioId: number; compraId?: number; pagoProveedorId?: number },
) {
  const dia = diaUTC(hoyISO());
  await exigirCajaAbierta(tx, dia);
  if (d.medio === "EFECTIVO") await exigirEfectivo(tx, dia, d.valor);
  return tx.movimientoCaja.create({
    data: {
      dia,
      tipo: "EGRESO",
      concepto: d.concepto,
      valor: d.valor,
      medio: d.medio,
      usuarioId: d.usuarioId,
      compraId: d.compraId,
      pagoProveedorId: d.pagoProveedorId,
    },
  });
}

/** Abono a un proveedor: a la compra más antigua o, si se indica, primero a la compra elegida. */
export async function abonarProveedor(
  tx: Tx,
  d: {
    proveedorId: number;
    usuarioId: number;
    valor: number;
    medio: Medio;
    referencia: string | null;
    compraId: number | null;
    concepto: string;
  },
) {
  await bloquearProveedor(tx, d.proveedorId);
  const deudas = await comprasPorPagar(d.proveedorId, tx);
  const aplicaciones = (d.compraId === null ? aplicarPagoFIFO(deudas, d.valor) : aplicarPagoARecibo(deudas, d.valor, d.compraId)).map(
    (a) => ({
      compraId: a.ventaId,
      valor: a.valor,
    }),
  );
  const pago = await tx.pagoProveedor.create({
    data: {
      proveedorId: d.proveedorId,
      dia: diaUTC(hoyISO()),
      valor: d.valor,
      medio: d.medio,
      referencia: d.referencia,
      usuarioId: d.usuarioId,
      aplicaciones: { create: aplicaciones },
    },
  });
  for (const a of aplicaciones) await tx.compra.update({ where: { id: a.compraId }, data: { saldo: { decrement: a.valor } } });
  await egresoProveedor(tx, { valor: d.valor, medio: d.medio, concepto: d.concepto, usuarioId: d.usuarioId, pagoProveedorId: pago.id });
  return { pago, aplicaciones };
}
