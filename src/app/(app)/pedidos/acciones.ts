"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditar } from "@/lib/auditoria";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import { db } from "@/lib/db";
import { bloquearCliente, bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, formatoCantidad, hoyISO, sumarDias } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { crearPago, leerMedio } from "@/lib/pagos";
import { requerir } from "@/lib/sesion";
import { faltantes, unidadesInventario } from "@/modules/inventario";
import { precioParaCliente, totalPedido } from "@/modules/precios";

export async function crearPedido(clienteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pedidos.crear");
  let id: number;
  try {
    const cliente = await db.cliente.findUnique({ where: { id: clienteId }, include: { precios: true } });
    if (!cliente || !cliente.activo) throw new ErrorUsuario("Cliente no encontrado o inactivo.");
    const fechaISO = texto(form, "fechaEntrega");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO) || fechaISO < hoyISO()) throw new ErrorUsuario("La fecha de entrega no es válida.");

    const productos = await db.producto.findMany({ where: { activo: true } });
    const especiales = new Map(cliente.precios.map((p) => [p.productoId, p.precio]));
    // El precio se toma del servidor y queda congelado en el pedido.
    const detalles = productos
      .map((p) => ({
        productoId: p.id,
        cantidad: entero(form, `cantidad_${p.id}`) ?? 0,
        precioUnitario: precioParaCliente({ productoId: p.id, precioGeneral: p.precioGeneral }, especiales),
      }))
      .filter((d) => d.cantidad > 0);
    if (detalles.length === 0) throw new ErrorUsuario("Escribe al menos una cantidad.");

    id = await db.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          clienteId,
          fechaEntrega: diaUTC(fechaISO),
          nota: textoOpcional(form, "nota"),
          creadoPorId: sesion.usuario.id,
          detalles: { create: detalles },
        },
      });
      await auditar(tx, sesion.usuario.id, "Pedido", pedido.id, "crear", { clienteId, detalles, total: totalPedido(detalles) });
      return pedido.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect(`/pedidos/${id}`);
}

export async function cancelarPedido(id: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pedidos.crear");
  try {
    await db.$transaction(async (tx) => {
      const r = await tx.pedido.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "CANCELADO" } });
      if (r.count === 0) throw new ErrorUsuario("Solo se pueden cancelar pedidos pendientes.");
      await auditar(tx, sesion.usuario.id, "Pedido", id, "cancelar");
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/pedidos/${id}`);
  return { ok: "Pedido cancelado." };
}

/**
 * Entrega un pedido: crea la venta con su recibo, descuenta el inventario y
 * registra lo que el cliente pagó. Lo que no pagó queda como fiado.
 */
export async function entregarPedido(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pedidos.entregar");
  try {
    const pagado = entero(form, "pagado") ?? 0;
    const medio = pagado > 0 ? leerMedio(form) : null;

    await db.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: { detalles: { include: { producto: true } }, cliente: true },
      });
      if (!pedido) throw new ErrorUsuario("Pedido no encontrado.");
      await bloquearCliente(tx, pedido.clienteId);
      const marcado = await tx.pedido.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "ENTREGADO" } });
      if (marcado.count === 0) throw new ErrorUsuario("Este pedido ya no está pendiente.");

      const total = totalPedido(pedido.detalles);
      if (pagado > total) throw new ErrorUsuario("Lo pagado no puede ser mayor que el total del pedido.");

      const salidas = pedido.detalles.map((d) => ({
        productoId: d.productoId,
        unidades: unidadesInventario(d.producto.tipo, d.cantidad),
      }));
      const falta = faltantes(salidas, await bloquearExistencias(tx, salidas.map((s) => s.productoId)));
      if (falta.length > 0) {
        const nombres = new Map(pedido.detalles.map((d) => [d.productoId, d.producto]));
        const detalle = falta
          .map((f) => {
            const p = nombres.get(f.productoId)!;
            return `${p.nombre} (hay ${formatoCantidad(p.tipo, f.disponible)})`;
          })
          .join(", ");
        throw new ErrorUsuario(`No hay inventario suficiente: ${detalle}.`);
      }

      const venta = await tx.venta.create({
        data: {
          consecutivo: await siguienteConsecutivo(tx, "VENTA"),
          pedidoId: id,
          clienteId: pedido.clienteId,
          total,
          saldo: total,
          vence: sumarDias(diaUTC(hoyISO()), pedido.cliente.diasCredito),
          usuarioId: sesion.usuario.id,
        },
      });
      await registrarMovimientos(
        tx,
        salidas.map((s) => ({
          productoId: s.productoId,
          cantidad: -s.unidades,
          tipo: "VENTA" as const,
          ventaId: venta.id,
          usuarioId: sesion.usuario.id,
        })),
      );
      if (pagado > 0 && medio) {
        await crearPago(tx, {
          clienteId: pedido.clienteId,
          usuarioId: sesion.usuario.id,
          valor: pagado,
          ...medio,
          aplicaciones: [{ ventaId: venta.id, valor: pagado }],
        });
      }
      await auditar(tx, sesion.usuario.id, "Venta", venta.id, "entregar", { pedidoId: id, total, pagado });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/pedidos/${id}`);
  return { ok: "Pedido entregado. Ya puedes descargar el recibo." };
}

/** Anula una venta entregada: devuelve el inventario y elimina la deuda. */
export async function anularVenta(ventaId: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  let pedidoId: number | null = null;
  let clienteId: number | null = null;
  try {
    await db.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        include: { movimientos: true, aplicaciones: { include: { pago: true } } },
      });
      if (!venta) throw new ErrorUsuario("Venta no encontrada.");
      pedidoId = venta.pedidoId;
      clienteId = venta.clienteId;
      await bloquearCliente(tx, venta.clienteId);
      if (venta.aplicaciones.some((a) => !a.pago.anulado))
        throw new ErrorUsuario("La venta tiene pagos. Anula primero esos pagos en la ficha del cliente.");
      const marcada = await tx.venta.updateMany({ where: { id: ventaId, anulada: false }, data: { anulada: true, saldo: 0 } });
      if (marcada.count === 0) throw new ErrorUsuario("Esta venta ya estaba anulada.");
      const salidas = venta.movimientos.filter((m) => m.tipo === "VENTA");
      if (salidas.length > 0) {
        await registrarMovimientos(
          tx,
          salidas.map((m) => ({
            productoId: m.productoId,
            cantidad: -m.cantidad,
            tipo: "ANULACION" as const,
            ventaId,
            nota: "Anulación de venta",
            usuarioId: sesion.usuario.id,
          })),
        );
      }
      if (venta.pedidoId) await tx.pedido.update({ where: { id: venta.pedidoId }, data: { estado: "CANCELADO" } });
      await auditar(tx, sesion.usuario.id, "Venta", ventaId, "anular", { total: venta.total });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  if (pedidoId) revalidatePath(`/pedidos/${pedidoId}`);
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Venta anulada y mercancía devuelta al inventario." };
}
