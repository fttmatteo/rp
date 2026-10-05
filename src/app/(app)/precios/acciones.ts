"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { entero, mensajeError, ErrorUsuario, texto, type EstadoForm } from "@/lib/form";
import { UNIDADES_GALLINAZA } from "@/lib/formato";
import { requerir } from "@/lib/sesion";

export async function guardarPreciosGenerales(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("precios");
  try {
    const productos = await db.producto.findMany();
    // Se lee todo antes de escribir para que un error no deje cambios a medias.
    await db.$transaction(async (tx) => {
      for (const p of productos) {
        const activo = form.get(`activo_${p.id}`) === "on";
        const general = entero(form, `general_${p.id}`, `Precio general de ${p.nombre}`) ?? 0;
        if (activo && general <= 0) throw new ErrorUsuario(`Escribe el precio general de ${p.nombre} para ponerlo en venta.`);
        const sugerido = entero(form, `sugerido_${p.id}`, `Precio sugerido de ${p.nombre}`) || null;
        const minimo = entero(form, `minimo_${p.id}`, `Mínimo de ${p.nombre}`);
        let unidad = p.unidad;
        if (p.tipo === "GALLINAZA") {
          const elegida = texto(form, `unidad_${p.id}`);
          if (!(UNIDADES_GALLINAZA as readonly string[]).includes(elegida)) throw new ErrorUsuario("Elige la unidad de la gallinaza.");
          unidad = elegida;
        }
        if (general === p.precioGeneral && sugerido === p.precioClienteSugerido && activo === p.activo && unidad === p.unidad && minimo === p.minimo) continue;
        await tx.producto.update({ where: { id: p.id }, data: { precioGeneral: general, precioClienteSugerido: sugerido, activo, unidad, minimo } });
        if (general !== p.precioGeneral) {
          await tx.historialPrecio.create({
            data: { productoId: p.id, precioAnterior: p.precioGeneral, precioNuevo: general, usuarioId: sesion.usuario.id },
          });
        }
        await auditar(tx, sesion.usuario.id, "Producto", p.id, "precios", { general, sugerido, activo, unidad, minimo });
      }
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/precios");
  return { ok: "Precios guardados. Los pedidos ya creados conservan su precio." };
}
