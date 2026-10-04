import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";

export async function auditar(
  tx: Tx,
  usuarioId: number,
  entidad: string,
  entidadId: string | number | null,
  accion: string,
  detalle?: object,
): Promise<void> {
  await tx.auditoria.create({
    data: {
      usuarioId,
      entidad,
      entidadId: entidadId === null ? null : String(entidadId),
      accion,
      detalle: detalle as Prisma.InputJsonValue | undefined,
    },
  });
}
