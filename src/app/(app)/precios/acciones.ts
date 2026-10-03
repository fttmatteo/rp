"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { entero, mensajeError, ErrorUsuario, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";

export async function guardarPreciosGenerales(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("precios");
  try {
    const productos = await db.producto.findMany();
    await db.$transaction(async (tx) => {
      for (const p of productos) {
        const general = entero(form, `general_${p.id}`);
        if (general === null || general <= 0) throw new ErrorUsuario(`Escribe el precio general de ${p.nombre}.`);
        const sugerido = entero(form, `sugerido_${p.id}`) || null;
        if (general === p.precioGeneral && sugerido === p.precioClienteSugerido) continue;
        await tx.producto.update({ where: { id: p.id }, data: { precioGeneral: general, precioClienteSugerido: sugerido } });
        if (general !== p.precioGeneral) {
          await tx.historialPrecio.create({
            data: { productoId: p.id, precioAnterior: p.precioGeneral, precioNuevo: general, usuarioId: sesion.usuario.id },
          });
        }
        await auditar(tx, sesion.usuario.id, "Producto", p.id, "precios", { general, sugerido });
      }
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/precios");
  return { ok: "Precios guardados. Los pedidos ya creados conservan su precio." };
}
