"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mensajeError, texto, type EstadoForm } from "@/lib/form";
import { crearSesion, cerrarSesion } from "@/lib/sesion";
import { esOperacion, type Operacion } from "@/lib/permisos";

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
// Hash de relleno: si el usuario no existe se compara igual, para no revelar por el tiempo de respuesta qué usuarios existen.
const HASH_RELLENO = bcrypt.hashSync("rp-relleno", 10);

export async function iniciarSesion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const usuario = texto(form, "usuario").toLowerCase();
  const clave = texto(form, "clave");
  if (!usuario || !clave) return { error: "Escribe tu usuario y tu clave." };

  let unico: Operacion | null;
  try {
    const encontrado = await db.usuario.findUnique({ where: { usuario } });
    if (encontrado?.bloqueadoHasta && encontrado.bloqueadoHasta > new Date())
      return { error: "Demasiados intentos fallidos. Espera unos minutos o pide al administrador que cambie tu clave." };

    const coincide = await bcrypt.compare(clave, encontrado?.claveHash ?? HASH_RELLENO);
    if (!encontrado || !encontrado.activo || !coincide) {
      if (encontrado) {
        const { intentosFallidos } = await db.usuario.update({
          where: { id: encontrado.id },
          data: { intentosFallidos: { increment: 1 } },
        });
        if (intentosFallidos >= MAX_INTENTOS)
          await db.usuario.update({
            where: { id: encontrado.id },
            data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) },
          });
      }
      return { error: "Usuario o clave incorrectos." };
    }
    if (encontrado.intentosFallidos > 0 || encontrado.bloqueadoHasta)
      await db.usuario.update({ where: { id: encontrado.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });

    // Con un solo acceso no hace falta elegir operación.
    const accesos = encontrado.accesos.filter(esOperacion);
    unico = accesos.length === 1 ? accesos[0] : null;
    await crearSesion(encontrado.id, unico);
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect(unico ? "/" : "/operacion");
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect("/login");
}
