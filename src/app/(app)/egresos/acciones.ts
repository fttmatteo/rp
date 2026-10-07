"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { entero, ErrorUsuario, mensajeError, type EstadoForm } from "@/lib/form";
import { leerMedio } from "@/lib/pagos";
import { abonarProveedor } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";

/** Pago a un proveedor elegido de la lista, a sus compras más antiguas. Sale de la caja de hoy. */
export async function registrarPagoProveedor(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("compras");
  try {
    const proveedorId = entero(form, "proveedorId", "Proveedor");
    const proveedor = proveedorId ? await db.proveedor.findUnique({ where: { id: proveedorId } }) : null;
    if (!proveedor) throw new ErrorUsuario("Elige el proveedor.");
    const valor = entero(form, "valor", "Valor") ?? 0;
    const { medio, referencia } = leerMedio(form);
    await db.$transaction(async (tx) => {
      const { pago, aplicaciones } = await abonarProveedor(tx, {
        proveedorId: proveedor.id,
        usuarioId: sesion.usuario.id,
        valor,
        medio,
        referencia,
        compraId: null,
        concepto: `Abono a proveedor ${proveedor.nombre}`,
      });
      await auditar(tx, sesion.usuario.id, "PagoProveedor", pago.id, "abono", { valor, medio, aplicaciones });
    });
    revalidatePath(`/proveedores/${proveedor.id}`);
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/egresos");
  revalidatePath("/caja");
  return { ok: "Pago registrado y descontado de la caja." };
}
