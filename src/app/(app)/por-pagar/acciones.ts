"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import { leerMedio } from "@/lib/pagos";
import { abonarProveedor, bloquearProveedor } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";

/** Abono a las cuentas por pagar: sale de la caja de hoy. */
export async function registrarAbonoProveedor(proveedorId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("compras");
  try {
    const valor = entero(form, "valor", "Valor") ?? 0;
    const { medio, referencia } = leerMedio(form);
    const compra = textoOpcional(form, "compra");
    const compraId = compra ? Number(compra) : null;
    if (compraId !== null && !Number.isInteger(compraId)) throw new ErrorUsuario("La compra elegida no es válida.");
    const proveedor = await db.proveedor.findUnique({ where: { id: proveedorId } });
    if (!proveedor) throw new ErrorUsuario("Proveedor no encontrado.");
    await db.$transaction(async (tx) => {
      const { pago, aplicaciones } = await abonarProveedor(tx, {
        proveedorId,
        usuarioId: sesion.usuario.id,
        valor,
        medio,
        referencia,
        compraId,
        concepto: `Abono a proveedor ${proveedor.nombre}`,
      });
      await auditar(tx, sesion.usuario.id, "PagoProveedor", pago.id, "abono", { valor, medio, aplicaciones });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/por-pagar/${proveedorId}`);
  return { ok: "Abono registrado y descontado de la caja." };
}

/** Solo el administrador: devuelve el abono a la deuda y el dinero a la caja. */
export async function anularPagoProveedor(pagoId: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  let proveedorId: number;
  try {
    proveedorId = await db.$transaction(async (tx) => {
      const pago = await tx.pagoProveedor.findUnique({ where: { id: pagoId }, include: { aplicaciones: true, movimientosCaja: true } });
      if (!pago) throw new ErrorUsuario("Pago no encontrado.");
      await bloquearProveedor(tx, pago.proveedorId);
      await exigirCajaAbierta(tx, pago.dia);
      const r = await tx.pagoProveedor.updateMany({ where: { id: pagoId, anulado: false }, data: { anulado: true } });
      if (r.count === 0) throw new ErrorUsuario("Este pago ya estaba anulado.");
      for (const a of pago.aplicaciones) await tx.compra.update({ where: { id: a.compraId }, data: { saldo: { increment: a.valor } } });
      await tx.movimientoCaja.updateMany({ where: { pagoProveedorId: pagoId }, data: { anulado: true } });
      await auditar(tx, sesion.usuario.id, "PagoProveedor", pagoId, "anular", { valor: pago.valor });
      return pago.proveedorId;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/por-pagar/${proveedorId}`);
  return { ok: "Pago anulado." };
}

/** Solo el administrador: carga lo que se le debía al proveedor antes de usar la app (no mueve huevo ni caja). */
export async function registrarSaldoInicialProveedor(proveedorId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  try {
    const valor = entero(form, "valor", "Valor") ?? 0;
    if (valor <= 0) throw new ErrorUsuario("El valor debe ser mayor que cero.");
    const fechaISO = texto(form, "fecha");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO) || fechaISO > hoyISO()) throw new ErrorUsuario("Fecha no válida.");
    const proveedor = await db.proveedor.findUnique({ where: { id: proveedorId } });
    if (!proveedor) throw new ErrorUsuario("Proveedor no encontrado.");
    await db.$transaction(async (tx) => {
      await bloquearProveedor(tx, proveedorId);
      const dia = diaUTC(fechaISO);
      const compra = await tx.compra.create({
        data: {
          tipo: "SALDO_INICIAL",
          proveedorId,
          fecha: new Date(`${fechaISO}T12:00:00-05:00`),
          dia,
          usuarioId: sesion.usuario.id,
          clasificada: false,
          huevos: 0,
          total: valor,
          saldo: valor,
          formaPago: "CREDITO",
          vence: sumarDias(dia, proveedor.diasCredito),
          nota: textoOpcional(form, "nota"),
        },
      });
      await auditar(tx, sesion.usuario.id, "Compra", compra.id, "saldo_inicial", { valor, fecha: fechaISO });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/por-pagar/${proveedorId}`);
  return { ok: "Saldo inicial cargado." };
}
