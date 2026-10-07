import "server-only";
import type { Ruta } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { ErrorUsuario } from "@/lib/form";

/** Bloquea la ruta hasta el fin de la transacción, para que no se liquide mientras entra un cobro. */
export async function bloquearRuta(tx: Tx, id: number): Promise<Ruta> {
  await tx.$queryRaw`SELECT 1 FROM "Ruta" WHERE "id" = ${id} FOR UPDATE`;
  const ruta = await tx.ruta.findUnique({ where: { id } });
  if (!ruta) throw new ErrorUsuario("Ruta no encontrada.");
  return ruta;
}

/** Bloquea la ruta y exige que siga abierta (sin precierre ni liquidación). */
export async function exigirRutaAbierta(tx: Tx, id: number): Promise<Ruta> {
  const ruta = await bloquearRuta(tx, id);
  if (ruta.estado === "PRECERRADA")
    throw new ErrorUsuario("Esta ruta ya tiene precierre. El administrador debe devolverla para registrar más entregas o cobros.");
  if (ruta.estado !== "ABIERTA")
    throw new ErrorUsuario("Esta ruta ya se liquidó. El administrador debe reabrirla para registrar más entregas o cobros.");
  return ruta;
}
