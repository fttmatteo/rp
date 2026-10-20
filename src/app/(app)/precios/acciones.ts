"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { entero, mensajeError, ErrorUsuario, texto, type EstadoForm } from "@/lib/form";
import { bloquearExistencias } from "@/lib/existencias";
import { UNIDADES_GALLINAZA } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { valorAGuardar } from "@/modules/precios";

export async function guardarPreciosGenerales(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("precios");
  try {
    // Todo en una transacción para que un error no deje cambios a medias.
    await db.$transaction(async (tx) => {
      const ids = (await tx.producto.findMany({ select: { id: true } })).map((p) => p.id);
      // Se bloquean los productos para que dos personas que guardan a la vez no se pisen.
      await bloquearExistencias(tx, ids);
      const productos = await tx.producto.findMany({ orderBy: { id: "asc" } });
      for (const p of productos) {
        // Cada campo trae al lado el valor con que se abrió la página (antes_*): así se sabe qué cambió esta persona.
        const campo = <T>(nombre: string, leer: (c: string) => T, actual: T, etiqueta: string): T => {
          const antes = form.has(`antes_${nombre}_${p.id}`) ? leer(`antes_${nombre}_${p.id}`) : undefined;
          const { valor, choque } = valorAGuardar(leer(`${nombre}_${p.id}`), antes, actual);
          if (choque)
            throw new ErrorUsuario(
              `Otra persona cambió ${etiqueta} de ${p.nombre} mientras tenías la página abierta. Recarga la página y vuelve a escribir tu cambio.`,
            );
          return valor;
        };
        const activo = campo("activo", (c) => form.get(c) === "on", p.activo, "si está en venta");
        const general = campo("general", (c) => entero(form, c, `Precio general de ${p.nombre}`) ?? 0, p.precioGeneral, "el precio general");
        if (activo && general <= 0) throw new ErrorUsuario(`Escribe el precio general de ${p.nombre} para ponerlo en venta.`);
        const sugerido = campo("sugerido", (c) => entero(form, c, `Precio sugerido de ${p.nombre}`) || null, p.precioClienteSugerido, "el precio sugerido");
        let gramosMin: number | null = null;
        let gramosMax: number | null = null;
        if (p.tipo === "CUBETA") {
          gramosMin = campo("gramosMin", (c) => entero(form, c, `Peso desde de ${p.nombre}`), p.gramosMin, "el peso desde");
          gramosMax = campo("gramosMax", (c) => entero(form, c, `Peso hasta de ${p.nombre}`), p.gramosMax, "el peso hasta");
          if (gramosMin === 0 || gramosMax === 0) throw new ErrorUsuario(`El peso de ${p.nombre} debe ser mayor que 0 gramos.`);
          if (gramosMin !== null && gramosMax !== null && gramosMin > gramosMax) {
            throw new ErrorUsuario(`En ${p.nombre} el peso «desde» no puede ser mayor que el peso «hasta».`);
          }
        }
        let unidad = p.unidad;
        if (p.tipo === "GALLINAZA") {
          unidad = campo("unidad", (c) => texto(form, c), p.unidad ?? "bulto", "la unidad");
          if (!(UNIDADES_GALLINAZA as readonly string[]).includes(unidad)) throw new ErrorUsuario("Elige la unidad de la gallinaza.");
        }
        if (general === p.precioGeneral && sugerido === p.precioClienteSugerido && activo === p.activo && unidad === p.unidad && gramosMin === p.gramosMin && gramosMax === p.gramosMax) continue;
        await tx.producto.update({
          where: { id: p.id },
          data: { precioGeneral: general, precioClienteSugerido: sugerido, activo, unidad, gramosMin, gramosMax },
        });
        if (general !== p.precioGeneral) {
          await tx.historialPrecio.create({
            data: { productoId: p.id, precioAnterior: p.precioGeneral, precioNuevo: general, usuarioId: sesion.usuario.id },
          });
        }
        await auditar(tx, sesion.usuario.id, "Producto", p.id, "precios", { general, sugerido, activo, unidad, gramosMin, gramosMax });
      }
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/precios");
  return { ok: "Precios y pesos guardados. Los pedidos ya creados conservan su precio." };
}
