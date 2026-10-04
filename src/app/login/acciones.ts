"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { texto, type EstadoForm } from "@/lib/form";
import { crearSesion, cerrarSesion } from "@/lib/sesion";
import { esOperacion } from "@/lib/permisos";

export async function iniciarSesion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = texto(form, "usuario").toLowerCase();
  const clave = texto(form, "clave");
  if (!usuario || !clave) return { error: "Escribe tu usuario y tu clave." };

  const encontrado = await db.usuario.findUnique({ where: { usuario } });
  const valido = encontrado?.activo && (await bcrypt.compare(clave, encontrado.claveHash));
  if (!encontrado || !valido) return { error: "Usuario o clave incorrectos." };

  // Con un solo acceso no hace falta elegir operación.
  const accesos = encontrado.accesos.filter(esOperacion);
  const unico = accesos.length === 1 ? accesos[0] : null;
  await crearSesion(encontrado.id, unico);
  redirect(unico ? "/" : "/operacion");
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect("/login");
}
