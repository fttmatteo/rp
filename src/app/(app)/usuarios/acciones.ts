"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ErrorUsuario, mensajeError, texto, type EstadoForm } from "@/lib/form";
import { OPERACIONES, type Operacion } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";

const CLAVE_MINIMA = 8;

function leerAccesos(form: FormData): Operacion[] {
  const elegidos = form.getAll("accesos");
  const accesos = OPERACIONES.filter((op) => elegidos.includes(op));
  if (accesos.length === 0) throw new ErrorUsuario("Asigna al menos un acceso.");
  return accesos;
}

export async function crearUsuario(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("usuarios");
  let id: number;
  try {
    const nombre = texto(form, "nombre");
    const usuario = texto(form, "usuario").toLowerCase();
    const clave = texto(form, "clave");
    if (!nombre) throw new ErrorUsuario("Escribe el nombre.");
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario))
      throw new ErrorUsuario("El usuario debe tener de 3 a 30 letras, números, punto o guion, sin espacios.");
    if (clave.length < CLAVE_MINIMA) throw new ErrorUsuario(`La clave debe tener al menos ${CLAVE_MINIMA} caracteres.`);
    const accesos = leerAccesos(form);
    if (await db.usuario.findUnique({ where: { usuario } })) throw new ErrorUsuario("Ese usuario ya existe.");

    const claveHash = await bcrypt.hash(clave, 10);
    id = await db.$transaction(async (tx) => {
      const nuevo = await tx.usuario.create({ data: { nombre, usuario, claveHash, accesos } });
      await auditar(tx, sesion.usuario.id, "Usuario", nuevo.id, "crear", { usuario, accesos });
      return nuevo.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  // Como con clientes y proveedores: al crearlo se abre su ficha.
  revalidatePath("/usuarios");
  redirect(`/usuarios/${id}?creado=1`);
}

export async function actualizarUsuario(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("usuarios");
  try {
    const nombre = texto(form, "nombre");
    if (!nombre) throw new ErrorUsuario("Escribe el nombre.");
    const accesos = leerAccesos(form);
    const activo = form.get("activo") === "on";
    const clave = texto(form, "clave");
    if (clave && clave.length < CLAVE_MINIMA) throw new ErrorUsuario(`La clave debe tener al menos ${CLAVE_MINIMA} caracteres.`);
    if (id === sesion.usuario.id && (!accesos.includes("ADMIN") || !activo))
      throw new ErrorUsuario("No puedes quitarte a ti mismo el acceso de administrador ni desactivarte.");

    const claveHash = clave ? await bcrypt.hash(clave, 10) : undefined;
    await db.$transaction(async (tx) => {
      // Cambiar la clave también levanta un bloqueo por intentos fallidos.
      const desbloqueo = claveHash ? { intentosFallidos: 0, bloqueadoHasta: null } : {};
      await tx.usuario.update({ where: { id }, data: { nombre, accesos, activo, claveHash, ...desbloqueo } });
      // Al desactivar o cambiar la clave, se cierran sus sesiones abiertas.
      if (!activo || claveHash) await tx.sesion.deleteMany({ where: { usuarioId: id } });
      await auditar(tx, sesion.usuario.id, "Usuario", id, "actualizar", { accesos, activo, cambioClave: Boolean(claveHash) });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/usuarios");
  return { ok: "Cambios guardados." };
}
