import "server-only";
import type { Caja } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { ErrorUsuario } from "@/lib/form";
import { formatoDia, formatoPesos } from "@/lib/formato";
import { efectivoEsperado, type TotalesCaja } from "@/modules/caja";

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

/** Para gastos en efectivo: exige que en la caja de ese día haya suficiente efectivo. */
export async function exigirEfectivo(tx: Tx, dia: Date, valor: number): Promise<void> {
  const caja = await obtenerCaja(dia, tx);
  const disponible = efectivoEsperado(await totalesCaja(dia, caja.base, tx));
  if (valor > disponible) throw new ErrorUsuario(`No hay tanto efectivo en caja (hay ${formatoPesos(disponible)}). Regístralo por transferencia o revisa la caja.`);
}

export async function totalesCaja(dia: Date, base: number, c: Tx | typeof db = db): Promise<TotalesCaja> {
  const porDia = await totalesCajaRango(dia, dia, c);
  return porDia.get(dia.getTime())?.(base) ?? armarTotales(base, [], []);
}

type FilaPago = { medio: string; _sum: { valor: number | null } };
type FilaMovimiento = { tipo: string; medio: string; _sum: { valor: number | null } };

function armarTotales(base: number, pagos: FilaPago[], movs: FilaMovimiento[]): TotalesCaja {
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

/**
 * Totales de varios días con dos consultas en lugar de dos por día.
 * Devuelve, por día con movimiento (clave: getTime()), una función que recibe la base de ese día.
 */
export async function totalesCajaRango(
  desde: Date,
  hasta: Date,
  c: Tx | typeof db = db,
): Promise<Map<number, (base: number) => TotalesCaja>> {
  const dia = { gte: desde, lte: hasta };
  const [pagos, movs] = await Promise.all([
    c.pago.groupBy({ by: ["dia", "medio"], where: { dia, anulado: false }, _sum: { valor: true } }),
    c.movimientoCaja.groupBy({ by: ["dia", "tipo", "medio"], where: { dia, anulado: false }, _sum: { valor: true } }),
  ]);
  const dias = new Set([...pagos, ...movs].map((f) => f.dia.getTime()));
  return new Map(
    [...dias].map((t) => [
      t,
      (base: number) =>
        armarTotales(
          base,
          pagos.filter((p) => p.dia.getTime() === t),
          movs.filter((m) => m.dia.getTime() === t),
        ),
    ]),
  );
}
