"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditar } from "@/lib/auditoria";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { leerMedio } from "@/lib/pagos";
import { abonarProveedor, bloquearProveedor } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";

function leerProveedor(form: FormData) {
  const nombre = texto(form, "nombre");
  if (!nombre) throw new ErrorUsuario("Escribe el nombre del proveedor.");
  const diasCredito = entero(form, "diasCredito", "Días de crédito");
  if (diasCredito === null) throw new ErrorUsuario("Escribe los días de crédito.");
  return { nombre, telefono: textoOpcional(form, "telefono"), notas: textoOpcional(form, "notas"), diasCredito };
}

export async function crearProveedor(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("compras");
  let id: number;
  try {
    const datos = leerProveedor(form);
    id = await db.$transaction(async (tx) => {
      const p = await tx.proveedor.create({ data: datos });
      await auditar(tx, sesion.usuario.id, "Proveedor", p.id, "crear", datos);
      return p.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect(`/proveedores/${id}`);
}

export async function actualizarProveedor(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("compras");
  try {
    const datos = { ...leerProveedor(form), activo: form.get("activo") === "on" };
    await db.$transaction(async (tx) => {
      await tx.proveedor.update({ where: { id }, data: datos });
      await auditar(tx, sesion.usuario.id, "Proveedor", id, "actualizar", datos);
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/proveedores/${id}`);
  return { ok: "Datos guardados." };
}

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
  revalidatePath(`/proveedores/${proveedorId}`);
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
  revalidatePath(`/proveedores/${proveedorId}`);
  return { ok: "Pago anulado." };
}
