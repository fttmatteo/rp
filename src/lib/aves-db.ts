import "server-only";
import type { Lote } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { avesVivas } from "@/modules/aves";

type Cliente = Tx | typeof db;

/** Novedades que tocan a estos lotes (como origen o destino de un traslado). */
export async function novedadesDe(loteIds: number[], c: Cliente = db) {
  return c.novedadLote.findMany({ where: { OR: [{ loteId: { in: loteIds } }, { loteDestinoId: { in: loteIds } }] } });
}

/** Aves vivas hoy de cada lote. */
export async function avesPorLote(lotes: Pick<Lote, "id" | "cantidadInicial">[], c: Cliente = db): Promise<Map<number, number>> {
  const novedades = await novedadesDe(
    lotes.map((l) => l.id),
    c,
  );
  return new Map(lotes.map((l) => [l.id, avesVivas(l, novedades)]));
}

/** Bloquea los lotes (en orden de id) para que dos novedades simultáneas no saquen más aves de las que hay. */
export async function bloquearLotes(tx: Tx, ids: number[]): Promise<void> {
  const ordenados = [...new Set(ids)].sort((a, b) => a - b);
  await tx.$queryRaw`SELECT 1 FROM "Lote" WHERE "id" = ANY(${ordenados}::int[]) ORDER BY "id" FOR UPDATE`;
}

/** Huevos recogidos por lote y día (clasificados + rotos), sin registros anulados. */
export async function huevosPorLoteYDia(loteIds: number[], desde: Date, hasta: Date) {
  const registros = await db.registroClasificacion.findMany({
    where: { loteId: { in: loteIds }, fecha: { gte: desde, lte: hasta }, movimientos: { none: { tipo: "ANULACION" } } },
    include: { detalles: { include: { producto: true } } },
  });
  const r = new Map<string, number>();
  for (const reg of registros) {
    const huevos = reg.detalles.filter((d) => d.producto.tipo === "CUBETA").reduce((s, d) => s + d.cantidad, 0) + reg.rotos;
    const clave = `${reg.loteId}|${reg.fecha.toISOString().slice(0, 10)}`;
    r.set(clave, (r.get(clave) ?? 0) + huevos);
  }
  return r;
}
