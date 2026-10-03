import type { Tx } from "@/lib/db";

/** Siguiente número de recibo. La fila queda bloqueada hasta que termina la transacción. */
export async function siguienteConsecutivo(tx: Tx, nombre: "VENTA" | "PAGO"): Promise<number> {
  const fila = await tx.consecutivo.upsert({
    where: { nombre },
    create: { nombre, valor: 1 },
    update: { valor: { increment: 1 } },
  });
  return fila.valor;
}
