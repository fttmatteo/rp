"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";
import { huevosDe } from "@/modules/inventario";

export async function registrarClasificacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("clasificacion");
  try {
    const fechaISO = texto(form, "fecha");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO) || fechaISO > hoyISO()) throw new ErrorUsuario("Fecha no válida.");
    const productos = await db.producto.findMany({ where: { activo: true } });
    const detalles = productos
      .map((p) => ({
        productoId: p.id,
        cantidad:
          p.tipo === "CUBETA"
            ? huevosDe(entero(form, `cubetas_${p.id}`, `Cubetas de ${p.nombre}`) ?? 0, entero(form, `sueltos_${p.id}`, `Huevos sueltos de ${p.nombre}`) ?? 0)
            : (entero(form, `unidades_${p.id}`, p.nombre) ?? 0),
      }))
      .filter((d) => d.cantidad > 0);
    if (detalles.length === 0) throw new ErrorUsuario("Escribe al menos una cantidad.");

    await db.$transaction(async (tx) => {
      const registro = await tx.registroClasificacion.create({
        data: {
          fecha: diaUTC(fechaISO),
          usuarioId: sesion.usuario.id,
          rotos: entero(form, "rotos", "Huevos rotos") ?? 0,
          nota: textoOpcional(form, "nota"),
          detalles: { create: detalles },
        },
      });
      await registrarMovimientos(
        tx,
        detalles.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          tipo: "PRODUCCION" as const,
          usuarioId: sesion.usuario.id,
          clasificacionId: registro.id,
        })),
      );
      await auditar(tx, sesion.usuario.id, "RegistroClasificacion", registro.id, "crear", { fecha: fechaISO, detalles });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/clasificacion");
  return { ok: "Clasificación registrada y sumada al inventario." };
}

/** Anula un registro equivocado: devuelve sus cantidades con movimientos de anulación. */
export async function anularClasificacion(id: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  try {
    await db.$transaction(async (tx) => {
      // Se bloquea el registro para que dos anulaciones simultáneas no lo anulen dos veces.
      await tx.$queryRaw`SELECT 1 FROM "RegistroClasificacion" WHERE "id" = ${id} FOR UPDATE`;
      const movs = await tx.movimientoInventario.findMany({ where: { clasificacionId: id } });
      if (movs.length === 0) throw new ErrorUsuario("Registro no encontrado.");
      if (movs.some((m) => m.tipo === "ANULACION")) throw new ErrorUsuario("Este registro ya fue anulado.");
      const stock = await bloquearExistencias(tx, movs.map((m) => m.productoId));
      for (const m of movs) {
        if ((stock.get(m.productoId) ?? 0) < m.cantidad)
          throw new ErrorUsuario("No se puede anular: parte de esa producción ya se vendió. Usa un ajuste de inventario.");
      }
      await registrarMovimientos(
        tx,
        movs.map((m) => ({
          productoId: m.productoId,
          cantidad: -m.cantidad,
          tipo: "ANULACION" as const,
          nota: `Anulación de clasificación #${id}`,
          usuarioId: sesion.usuario.id,
          clasificacionId: id,
        })),
      );
      await auditar(tx, sesion.usuario.id, "RegistroClasificacion", id, "anular");
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/clasificacion");
  return { ok: "Registro anulado." };
}
