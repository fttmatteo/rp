import "server-only";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import type { Tx } from "@/lib/db";
import { ErrorUsuario, texto, textoOpcional } from "@/lib/form";
import { diaUTC, hoyISO } from "@/lib/formato";

export type Medio = "EFECTIVO" | "TRANSFERENCIA";

export function leerMedio(form: FormData): { medio: Medio; referencia: string | null } {
  const medio = texto(form, "medio");
  if (medio !== "EFECTIVO" && medio !== "TRANSFERENCIA") throw new ErrorUsuario("Elige el medio de pago.");
  return { medio, referencia: textoOpcional(form, "referencia") };
}

/** Crea un pago en la caja de hoy y lo aplica a las deudas indicadas, bajando sus saldos. */
export async function crearPago(
  tx: Tx,
  datos: { clienteId: number; usuarioId: number; valor: number; medio: Medio; referencia: string | null; aplicaciones: { ventaId: number; valor: number }[] },
) {
  // El dinero entra a la caja de hoy, que debe estar abierta.
  const dia = diaUTC(hoyISO());
  await exigirCajaAbierta(tx, dia);
  const pago = await tx.pago.create({
    data: {
      dia,
      consecutivo: await siguienteConsecutivo(tx, "PAGO"),
      clienteId: datos.clienteId,
      valor: datos.valor,
      medio: datos.medio,
      referencia: datos.referencia,
      usuarioId: datos.usuarioId,
      aplicaciones: { create: datos.aplicaciones },
    },
  });
  for (const a of datos.aplicaciones) {
    await tx.venta.update({ where: { id: a.ventaId }, data: { saldo: { decrement: a.valor } } });
  }
  return pago;
}

