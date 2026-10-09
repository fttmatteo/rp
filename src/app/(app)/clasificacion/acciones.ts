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
    // Las gallinas para la venta salen de un galpón (Aves → Paso a venta), no de la clasificación.
    const productos = await db.producto.findMany({ where: { activo: true, tipo: { not: "GALLINA" } } });
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
    const rotos = entero(form, "rotos", "Huevos rotos") ?? 0;
    // Origen: producción propia (vacío) o una compra que llegó sin clasificar.
    const origen = texto(form, "origen");
    const compraId = origen ? Number(origen) : null;
    if (compraId !== null && !Number.isInteger(compraId)) throw new ErrorUsuario("El origen elegido no es válido.");
    if (compraId !== null && detalles.some((d) => productos.find((p) => p.id === d.productoId)?.tipo !== "CUBETA"))
      throw new ErrorUsuario("De una compra solo se clasifican huevos. Registra gallinas o gallinaza como producción propia.");

    const grupo = texto(form, "grupo");
    const grupoId = compraId === null && grupo ? Number(grupo) : null;
    if (grupoId !== null && !(await db.grupoAves.findFirst({ where: { id: grupoId, activo: true } }))) throw new ErrorUsuario("El galpón elegido ya no tiene aves.");

    await db.$transaction(async (tx) => {
      if (compraId !== null) {
        await tx.$queryRaw`SELECT 1 FROM "Compra" WHERE "id" = ${compraId} FOR UPDATE`;
        const compra = await tx.compra.findUnique({ where: { id: compraId } });
        if (!compra || compra.anulada || compra.clasificada) throw new ErrorUsuario("Esa compra no tiene huevo por clasificar.");
        const usados = detalles.reduce((s, d) => s + d.cantidad, 0) + rotos;
        if (usados > compra.porClasificar)
          throw new ErrorUsuario(`De esa compra solo quedan ${compra.porClasificar} huevos por clasificar (incluidos los rotos).`);
        await tx.compra.update({ where: { id: compraId }, data: { porClasificar: { decrement: usados } } });
      }
      const registro = await tx.registroClasificacion.create({
        data: {
          fecha: diaUTC(fechaISO),
          usuarioId: sesion.usuario.id,
          rotos,
          nota: textoOpcional(form, "nota"),
          compraId,
          grupoId,
          detalles: { create: detalles },
        },
      });
      await registrarMovimientos(
        tx,
        detalles.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          tipo: compraId === null ? ("PRODUCCION" as const) : ("COMPRA" as const),
          usuarioId: sesion.usuario.id,
          clasificacionId: registro.id,
          compraId,
        })),
      );
      await auditar(tx, sesion.usuario.id, "RegistroClasificacion", registro.id, "crear", { fecha: fechaISO, detalles, rotos, compraId, grupoId });
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
      const registro = await tx.registroClasificacion.findUnique({ where: { id } });
      // Mismo orden de bloqueo que al clasificar: primero la compra, luego los productos.
      if (registro?.compraId) await tx.$queryRaw`SELECT 1 FROM "Compra" WHERE "id" = ${registro.compraId} FOR UPDATE`;
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
          compraId: m.compraId,
        })),
      );
      // Lo que se clasificó de una compra vuelve a quedar por clasificar.
      if (registro?.compraId) {
        const devueltos = movs.reduce((s, m) => s + m.cantidad, 0) + registro.rotos;
        await tx.compra.update({ where: { id: registro.compraId }, data: { porClasificar: { increment: devueltos } } });
      }
      await auditar(tx, sesion.usuario.id, "RegistroClasificacion", id, "anular");
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/clasificacion");
  return { ok: "Registro anulado." };
}
