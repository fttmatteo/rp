import "server-only";
import type { Caja } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { ErrorUsuario } from "@/lib/form";
import { formatoDia } from "@/lib/formato";
import type { TotalesCaja } from "@/modules/caja";

const BLOQUEO_CAJA = 3;

/** Evita que entre un pago mientras se está cerrando ese mismo día. */
export async function bloquearCaja(tx: Tx, dia: Date): Promise<void> {
  const numero = Math.floor(dia.getTime() / 86_400_000);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BLOQUEO_CAJA}::int, ${numero}::int)`;
}

/**
 * Caja del día; si no existe se abre con el efectivo contado en el último cierre como base.
 * Con `crear = false` solo la calcula, para no abrir cajas al consultar días pasados.
 */
export async function obtenerCaja(dia: Date, c: Tx | typeof db = db, crear = true): Promise<Caja> {
  const existente = await c.caja.findUnique({ where: { dia } });
  if (existente) return existente;
  const anterior = await c.caja.findFirst({ where: { dia: { lt: dia }, estado: "CERRADA" }, orderBy: { dia: "desc" } });
  const base = anterior?.contado ?? 0;
  if (!crear) {
    return { dia, base, estado: "ABIERTA", esperado: null, contado: null, diferencia: null, observacion: null, cerradaEn: null, cerradaPorId: null };
  }
  return c.caja.upsert({ where: { dia }, create: { dia, base }, update: {} });
}

/** Lanza un error si la caja de ese día ya se cerró. */
export async function exigirCajaAbierta(tx: Tx, dia: Date): Promise<void> {
  await bloquearCaja(tx, dia);
  const caja = await obtenerCaja(dia, tx);
  if (caja.estado === "CERRADA")
    throw new ErrorUsuario(`La caja del ${formatoDia(dia)} ya está cerrada. El administrador debe reabrirla para registrar dinero.`);
}

export async function totalesCaja(dia: Date, base: number, c: Tx | typeof db = db): Promise<TotalesCaja> {
  const [pagos, movs] = await Promise.all([
    c.pago.groupBy({ by: ["medio"], where: { dia, anulado: false }, _sum: { valor: true } }),
    c.movimientoCaja.groupBy({ by: ["tipo", "medio"], where: { dia, anulado: false }, _sum: { valor: true } }),
  ]);
  const pago = (medio: string) => pagos.find((p) => p.medio === medio)?._sum.valor ?? 0;
  const mov = (tipo: string, medio: string) => movs.find((m) => m.tipo === tipo && m.medio === medio)?._sum.valor ?? 0;
  return {
    base,
    cobrosEfectivo: pago("EFECTIVO"),
    cobrosTransferencia: pago("TRANSFERENCIA"),
    ingresosEfectivo: mov("INGRESO", "EFECTIVO"),
    ingresosTransferencia: mov("INGRESO", "TRANSFERENCIA"),
    egresosEfectivo: mov("EGRESO", "EFECTIVO"),
    egresosTransferencia: mov("EGRESO", "TRANSFERENCIA"),
  };
}
