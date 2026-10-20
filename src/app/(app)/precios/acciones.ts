"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { entero, mensajeError, ErrorUsuario, texto, type EstadoForm } from "@/lib/form";
import { UNIDADES_GALLINAZA } from "@/lib/formato";
import { rangosCruzados, type RangoGramos } from "@/modules/pesos";
import { requerir } from "@/lib/sesion";

export async function guardarPreciosGenerales(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("precios");
  try {
    const productos = await db.producto.findMany({ orderBy: { orden: "asc" } });
    const rangos: RangoGramos[] = [];
    // Se lee todo antes de escribir para que un error no deje cambios a medias.
    await db.$transaction(async (tx) => {
      for (const p of productos) {
        const activo = form.get(`activo_${p.id}`) === "on";
        const general = entero(form, `general_${p.id}`, `Precio general de ${p.nombre}`) ?? 0;
        if (activo && general <= 0) throw new ErrorUsuario(`Escribe el precio general de ${p.nombre} para ponerlo en venta.`);
        const sugerido = entero(form, `sugerido_${p.id}`, `Precio sugerido de ${p.nombre}`) || null;
        const minimo = entero(form, `minimo_${p.id}`, `Mínimo de ${p.nombre}`);
        let gramosMin: number | null = null;
        let gramosMax: number | null = null;
        if (p.tipo === "CUBETA") {
          gramosMin = entero(form, `gramosMin_${p.id}`, `Peso desde de ${p.nombre}`);
          gramosMax = entero(form, `gramosMax_${p.id}`, `Peso hasta de ${p.nombre}`);
          if (gramosMin === 0 || gramosMax === 0) throw new ErrorUsuario(`El peso de ${p.nombre} debe ser mayor que 0 gramos.`);
          if (gramosMin !== null && gramosMax !== null && gramosMin > gramosMax) {
            throw new ErrorUsuario(`En ${p.nombre} el peso «desde» no puede ser mayor que el peso «hasta».`);
          }
          rangos.push({ nombre: p.nombre, gramosMin, gramosMax });
        }
        let unidad = p.unidad;
        if (p.tipo === "GALLINAZA") {
          const elegida = texto(form, `unidad_${p.id}`);
          if (!(UNIDADES_GALLINAZA as readonly string[]).includes(elegida)) throw new ErrorUsuario("Elige la unidad de la gallinaza.");
          unidad = elegida;
        }
        if (general === p.precioGeneral && sugerido === p.precioClienteSugerido && activo === p.activo && unidad === p.unidad && minimo === p.minimo && gramosMin === p.gramosMin && gramosMax === p.gramosMax) continue;
        await tx.producto.update({
          where: { id: p.id },
          data: { precioGeneral: general, precioClienteSugerido: sugerido, activo, unidad, minimo, gramosMin, gramosMax },
        });
        if (general !== p.precioGeneral) {
          await tx.historialPrecio.create({
            data: { productoId: p.id, precioAnterior: p.precioGeneral, precioNuevo: general, usuarioId: sesion.usuario.id },
          });
        }
        await auditar(tx, sesion.usuario.id, "Producto", p.id, "precios", { general, sugerido, activo, unidad, minimo, gramosMin, gramosMax });
      }
      // Un mismo peso no puede caer en dos tipos de huevo.
      const cruce = rangosCruzados(rangos);
      if (cruce) throw new ErrorUsuario(`Los pesos de ${cruce[0]} y ${cruce[1]} se cruzan. Un huevo solo puede caer en un tipo.`);
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/precios");
  return { ok: "Precios y pesos guardados. Los pedidos ya creados conservan su precio." };
}
