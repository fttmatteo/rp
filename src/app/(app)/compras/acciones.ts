"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { leerMedio } from "@/lib/pagos";
import { bloquearProveedor, egresoProveedor } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";
import { huevosDe } from "@/modules/inventario";

/**
 * Compra de huevo a un proveedor. Si llega clasificada, cada tipo suma directo al inventario;
 * si no, queda como huevo por clasificar. De contado sale de la caja de hoy; a crédito queda
 * como cuenta por pagar.
 */
export async function registrarCompra(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("compras");
  try {
    const proveedorId = entero(form, "proveedorId", "Proveedor");
    const proveedor = proveedorId ? await db.proveedor.findUnique({ where: { id: proveedorId } }) : null;
    if (!proveedor || !proveedor.activo) throw new ErrorUsuario("Elige el proveedor.");
    const ingreso = texto(form, "ingreso");
    if (ingreso !== "CLASIFICADA" && ingreso !== "SIN_CLASIFICAR")
      throw new ErrorUsuario("Elige si el huevo llegó clasificado o sin clasificar.");
    const clasificada = ingreso === "CLASIFICADA";

    const tipos = await db.producto.findMany({ where: { tipo: "CUBETA" } });
    const detalles = clasificada
      ? tipos
          .map((p) => ({
            productoId: p.id,
            cantidad: huevosDe(
              entero(form, `cubetas_${p.id}`, `Cubetas de ${p.nombre}`) ?? 0,
              entero(form, `sueltos_${p.id}`, `Huevos sueltos de ${p.nombre}`) ?? 0,
            ),
          }))
          .filter((d) => d.cantidad > 0)
      : [];
    const huevos = clasificada
      ? detalles.reduce((s, d) => s + d.cantidad, 0)
      : huevosDe(entero(form, "cubetas", "Cubetas") ?? 0, entero(form, "sueltos", "Huevos sueltos") ?? 0);
    if (huevos <= 0) throw new ErrorUsuario("Escribe cuánto huevo llegó.");
    const total = entero(form, "total", "Costo total") ?? 0;
    if (total <= 0) throw new ErrorUsuario("Escribe el costo total de la compra.");
    const formaPago = texto(form, "formaPago");
    if (formaPago !== "CONTADO" && formaPago !== "CREDITO") throw new ErrorUsuario("Elige si se paga de contado o a crédito.");
    const medio = formaPago === "CONTADO" ? leerMedio(form).medio : null;
    const hoy = diaUTC(hoyISO());

    await db.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          proveedorId: proveedor.id,
          dia: hoy,
          usuarioId: sesion.usuario.id,
          clasificada,
          huevos,
          porClasificar: clasificada ? 0 : huevos,
          total,
          saldo: formaPago === "CREDITO" ? total : 0,
          formaPago,
          vence: formaPago === "CREDITO" ? sumarDias(hoy, proveedor.diasCredito) : null,
          nota: textoOpcional(form, "nota"),
          detalles: { create: detalles },
        },
      });
      if (clasificada) {
        await registrarMovimientos(
          tx,
          detalles.map((d) => ({
            productoId: d.productoId,
            cantidad: d.cantidad,
            tipo: "COMPRA" as const,
            compraId: compra.id,
            usuarioId: sesion.usuario.id,
          })),
        );
      }
      if (medio) {
        await egresoProveedor(tx, {
          valor: total,
          medio,
          concepto: `Compra de huevo a ${proveedor.nombre}`,
          usuarioId: sesion.usuario.id,
          compraId: compra.id,
        });
      }
      await auditar(tx, sesion.usuario.id, "Compra", compra.id, "crear", {
        proveedorId: proveedor.id,
        clasificada,
        huevos,
        total,
        formaPago,
        medio,
      });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/compras");
  return { ok: "Compra registrada." };
}

/** Solo el administrador: devuelve el inventario y el dinero de una compra equivocada. */
export async function anularCompra(id: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  try {
    await db.$transaction(async (tx) => {
      const encontrada = await tx.compra.findUnique({ where: { id } });
      if (!encontrada) throw new ErrorUsuario("Compra no encontrada.");
      await bloquearProveedor(tx, encontrada.proveedorId);
      await tx.$queryRaw`SELECT 1 FROM "Compra" WHERE "id" = ${id} FOR UPDATE`;
      const compra = await tx.compra.findUniqueOrThrow({
        where: { id },
        include: { movimientos: true, aplicaciones: { include: { pago: true } }, movimientosCaja: true },
      });
      if (compra.anulada) throw new ErrorUsuario("Esta compra ya estaba anulada.");
      if (compra.aplicaciones.some((a) => !a.pago.anulado))
        throw new ErrorUsuario("La compra tiene abonos. Anula primero esos abonos en el proveedor.");
      if (!compra.clasificada && compra.porClasificar < compra.huevos)
        throw new ErrorUsuario("Ya se clasificó parte de esta compra. Anula primero esas clasificaciones.");

      const entradas = compra.movimientos.filter((m) => m.tipo === "COMPRA" && m.clasificacionId === null);
      if (entradas.length > 0) {
        const stock = await bloquearExistencias(
          tx,
          entradas.map((m) => m.productoId),
        );
        for (const m of entradas) {
          if ((stock.get(m.productoId) ?? 0) < m.cantidad)
            throw new ErrorUsuario("No se puede anular: parte de ese huevo ya se vendió. Usa un ajuste de inventario.");
        }
        await registrarMovimientos(
          tx,
          entradas.map((m) => ({
            productoId: m.productoId,
            cantidad: -m.cantidad,
            tipo: "ANULACION" as const,
            compraId: id,
            nota: `Anulación de compra #${id}`,
            usuarioId: sesion.usuario.id,
          })),
        );
      }
      for (const m of compra.movimientosCaja.filter((m) => !m.anulado)) {
        await exigirCajaAbierta(tx, m.dia);
        await tx.movimientoCaja.update({ where: { id: m.id }, data: { anulado: true } });
      }
      await tx.compra.update({ where: { id }, data: { anulada: true, saldo: 0, porClasificar: 0 } });
      await auditar(tx, sesion.usuario.id, "Compra", id, "anular", { total: compra.total, huevos: compra.huevos });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/compras");
  return { ok: "Compra anulada." };
}
