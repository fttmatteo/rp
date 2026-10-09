import "server-only";
import type { GrupoAves } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { avesVivas } from "@/modules/aves";

type Cliente = Tx | typeof db;

/** Novedades que tocan a estos grupos (como origen o destino de un traslado). */
export async function novedadesDe(grupoIds: number[], c: Cliente = db) {
  return c.novedadAves.findMany({ where: { OR: [{ grupoId: { in: grupoIds } }, { grupoDestinoId: { in: grupoIds } }] } });
}

/** Aves vivas hoy de cada grupo. */
export async function avesPorGrupo(grupos: Pick<GrupoAves, "id" | "cantidadInicial">[], c: Cliente = db): Promise<Map<number, number>> {
  const novedades = await novedadesDe(
    grupos.map((l) => l.id),
    c,
  );
  return new Map(grupos.map((l) => [l.id, avesVivas(l, novedades)]));
}

/** Bloquea los galpones (en orden de id) para que no entren dos grupos de aves a la vez al mismo galpón. */
export async function bloquearGalpones(tx: Tx, ids: number[]): Promise<void> {
  const ordenados = [...new Set(ids)].sort((a, b) => a - b);
  await tx.$queryRaw`SELECT 1 FROM "Galpon" WHERE "id" = ANY(${ordenados}::int[]) ORDER BY "id" FOR UPDATE`;
}

/** Huevos recogidos por grupo y día (clasificados + rotos), sin registros anulados. */
export async function huevosPorGrupoYDia(grupoIds: number[], desde: Date, hasta: Date) {
  const registros = await db.registroClasificacion.findMany({
    where: { grupoId: { in: grupoIds }, fecha: { gte: desde, lte: hasta }, movimientos: { none: { tipo: "ANULACION" } } },
    include: { detalles: { include: { producto: true } } },
  });
  const r = new Map<string, number>();
  for (const reg of registros) {
    const huevos = reg.detalles.filter((d) => d.producto.tipo === "CUBETA").reduce((s, d) => s + d.cantidad, 0) + reg.rotos;
    const clave = `${reg.grupoId}|${reg.fecha.toISOString().slice(0, 10)}`;
    r.set(clave, (r.get(clave) ?? 0) + huevos);
  }
  return r;
}
