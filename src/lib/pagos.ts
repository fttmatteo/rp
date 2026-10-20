import "server-only";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { deudasPendientes, saldoCliente } from "@/lib/cartera-db";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import type { Tx } from "@/lib/db";
import { bloquearCliente } from "@/lib/existencias";
import { ErrorUsuario, texto, textoOpcional } from "@/lib/form";
import { diaUTC, hoyISO } from "@/lib/formato";
import { aplicarPagoARecibo, aplicarPagoFIFO } from "@/modules/cartera";

export type Medio = "EFECTIVO" | "TRANSFERENCIA";

export function leerMedio(form: FormData): { medio: Medio; referencia: string | null } {
  const medio = texto(form, "medio");
  if (medio !== "EFECTIVO" && medio !== "TRANSFERENCIA") throw new ErrorUsuario("Elige el medio de pago.");
  return { medio, referencia: textoOpcional(form, "referencia") };
}

/** Crea un pago en la caja de hoy y lo aplica a las deudas indicadas, bajando sus saldos. */
export async function crearPago(
  tx: Tx,
  datos: {
    clienteId: number;
    usuarioId: number;
    valor: number;
    medio: Medio;
    referencia: string | null;
    aplicaciones: { ventaId: number; valor: number }[];
    // Ruta en la que lo cobró el repartidor (entra en su liquidación).
    rutaId?: number | null;
  },
) {
  // El dinero entra a la caja de hoy, que debe estar abierta.
  const dia = diaUTC(hoyISO());
  await exigirCajaAbierta(tx, dia);
  // El recibo muestra lo que quedó debiendo con este pago, aunque después abone o compre más.
  const aplicado = datos.aplicaciones.reduce((s, a) => s + a.valor, 0);
  const saldoDespues = (await saldoCliente(datos.clienteId, tx)) - aplicado;
  const pago = await tx.pago.create({
    data: {
      dia,
      consecutivo: await siguienteConsecutivo(tx, "PAGO"),
      clienteId: datos.clienteId,
      valor: datos.valor,
      medio: datos.medio,
      referencia: datos.referencia,
      usuarioId: datos.usuarioId,
      rutaId: datos.rutaId ?? null,
      saldoDespues,
      aplicaciones: { create: datos.aplicaciones },
    },
  });
  for (const a of datos.aplicaciones) {
    await tx.venta.update({ where: { id: a.ventaId }, data: { saldo: { decrement: a.valor } } });
  }
  return pago;
}

/**
 * Abono de un cliente: a la deuda más antigua o, si se indica, primero al recibo elegido
 * y lo que sobre a las demás empezando por la más antigua.
 */
export async function abonar(
  tx: Tx,
  datos: { clienteId: number; usuarioId: number; valor: number; medio: Medio; referencia: string | null; ventaId: number | null; rutaId?: number | null },
) {
  await bloquearCliente(tx, datos.clienteId);
  const deudas = await deudasPendientes(datos.clienteId, tx);
  const aplicaciones = datos.ventaId === null ? aplicarPagoFIFO(deudas, datos.valor) : aplicarPagoARecibo(deudas, datos.valor, datos.ventaId);
  const pago = await crearPago(tx, { ...datos, aplicaciones });
  return { pago, aplicaciones };
}
