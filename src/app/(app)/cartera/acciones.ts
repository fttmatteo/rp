"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { deudasPendientes } from "@/lib/cartera-db";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import { db } from "@/lib/db";
import { bloquearCliente } from "@/lib/existencias";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { crearPago, leerMedio } from "@/lib/pagos";
import { requerir } from "@/lib/sesion";
import { aplicarPagoFIFO } from "@/modules/cartera";

export async function registrarAbono(clienteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pagos.registrar");
  try {
    const valor = entero(form, "valor", "Valor") ?? 0;
    const { medio, referencia } = leerMedio(form);
    await db.$transaction(async (tx) => {
      await bloquearCliente(tx, clienteId);
      const aplicaciones = aplicarPagoFIFO(await deudasPendientes(clienteId, tx), valor);
      const pago = await crearPago(tx, { clienteId, usuarioId: sesion.usuario.id, valor, medio, referencia, aplicaciones });
      await auditar(tx, sesion.usuario.id, "Pago", pago.id, "abono", { valor, medio, aplicaciones });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Abono registrado. El recibo está en los movimientos del cliente." };
}

/** Anula un pago y devuelve su valor a las deudas a las que se aplicó. */
export async function anularPago(pagoId: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  let clienteId: number;
  try {
    clienteId = await db.$transaction(async (tx) => {
      const pago = await tx.pago.findUnique({ where: { id: pagoId }, include: { aplicaciones: true } });
      if (!pago) throw new ErrorUsuario("Pago no encontrado.");
      await bloquearCliente(tx, pago.clienteId);
      await exigirCajaAbierta(tx, pago.dia);
      const marcado = await tx.pago.updateMany({ where: { id: pagoId, anulado: false }, data: { anulado: true } });
      if (marcado.count === 0) throw new ErrorUsuario("Este pago ya estaba anulado.");
      for (const a of pago.aplicaciones) {
        await tx.venta.update({ where: { id: a.ventaId }, data: { saldo: { increment: a.valor } } });
      }
      await auditar(tx, sesion.usuario.id, "Pago", pagoId, "anular", { valor: pago.valor });
      return pago.clienteId;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Pago anulado." };
}

/** Carga la deuda que el cliente traía antes de usar la app. */
export async function registrarSaldoInicial(clienteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  try {
    const valor = entero(form, "valor", "Valor") ?? 0;
    if (valor <= 0) throw new ErrorUsuario("El valor debe ser mayor que cero.");
    const fechaISO = texto(form, "fecha");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO) || fechaISO > hoyISO()) throw new ErrorUsuario("Fecha no válida.");
    const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new ErrorUsuario("Cliente no encontrado.");
    await db.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        data: {
          consecutivo: await siguienteConsecutivo(tx, "VENTA"),
          tipo: "SALDO_INICIAL",
          clienteId,
          fecha: new Date(`${fechaISO}T12:00:00-05:00`),
          total: valor,
          saldo: valor,
          vence: sumarDias(diaUTC(fechaISO), cliente.diasCredito),
          usuarioId: sesion.usuario.id,
          nota: textoOpcional(form, "nota"),
        },
      });
      await auditar(tx, sesion.usuario.id, "Venta", venta.id, "saldo_inicial", { valor, fecha: fechaISO });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Saldo inicial cargado." };
}
