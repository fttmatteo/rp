"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import { db } from "@/lib/db";
import { bloquearCliente } from "@/lib/existencias";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { abonar, leerMedio } from "@/lib/pagos";
import { bloquearRuta } from "@/lib/rutas-db";
import { requerir } from "@/lib/sesion";

export async function registrarAbono(clienteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pagos.registrar");
  // Lo que cobra el repartidor debe quedar en su ruta para que la liquidación se lo cobre.
  if (sesion.operacion === "REPARTIDOR") return { error: "Registra el abono desde la parada del cliente en Mi ruta." };
  try {
    const valor = entero(form, "valor", "Valor") ?? 0;
    const { medio, referencia } = leerMedio(form);
    // Vacío = a la deuda más antigua; si no, al recibo que el cliente eligió.
    const recibo = textoOpcional(form, "recibo");
    const ventaId = recibo ? Number(recibo) : null;
    if (ventaId !== null && !Number.isInteger(ventaId)) throw new ErrorUsuario("El recibo elegido no es válido.");
    await db.$transaction(async (tx) => {
      const { pago, aplicaciones } = await abonar(tx, { clienteId, usuarioId: sesion.usuario.id, valor, medio, referencia, ventaId });
      await auditar(tx, sesion.usuario.id, "Pago", pago.id, "abono", { valor, medio, aplicaciones });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/cartera/${clienteId}`);
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
      // Orden de bloqueo en todo el sistema: cliente, ruta y caja.
      await bloquearCliente(tx, pago.clienteId);
      // Lo cobrado en una ruta ya liquidada no se puede cambiar sin reabrir la liquidación.
      if (pago.rutaId) {
        const ruta = await bloquearRuta(tx, pago.rutaId);
        if (ruta.estado === "LIQUIDADA")
          throw new ErrorUsuario("Este pago se cobró en una ruta ya liquidada. El administrador debe reabrir la liquidación primero.");
      }
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
  revalidatePath(`/cartera/${clienteId}`);
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
  revalidatePath(`/cartera/${clienteId}`);
  return { ok: "Saldo inicial cargado." };
}
