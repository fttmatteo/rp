"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
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
