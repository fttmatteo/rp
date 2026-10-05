"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { leerEntregadas, registrarEntrega, registrarNoEntrega } from "@/lib/entregas";
import { bloquearCliente, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { leerMedio } from "@/lib/pagos";
import { requerir } from "@/lib/sesion";
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
        cantidad: entero(form, `cantidad_${p.id}`, `Cantidad de ${p.nombre}`) ?? 0,
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
  // Se avisa en la página de destino que quedó creado.
  redirect(`/pedidos/${id}?creado=1`);
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
  let parcial = false;
  try {
    const pagado = entero(form, "pagado", "Valor pagado") ?? 0;
    const pago = pagado > 0 ? { valor: pagado, ...leerMedio(form) } : null;
    const entregadas = leerEntregadas(form);
    await db.$transaction(async (tx) => {
      const r = await registrarEntrega(tx, {
        pedidoId: id,
        usuarioId: sesion.usuario.id,
        entregadas,
        pago,
        repartidorId: sesion.operacion === "REPARTIDOR" ? sesion.usuario.id : null,
      });
      parcial = r.parcial;
      await auditar(tx, sesion.usuario.id, "Venta", r.venta.id, "entregar", { pedidoId: id, total: r.total, pagado, parcial });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/mi-ruta");
  return { ok: parcial ? "Entrega parcial registrada. Lo no entregado vuelve con el repartidor." : "Pedido entregado. Ya puedes descargar el recibo." };
}

/** El pedido no se pudo entregar (cliente cerrado, no lo recibió...). */
export async function marcarNoEntregado(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pedidos.entregar");
  try {
    const motivo = texto(form, "motivo");
    if (!motivo) throw new ErrorUsuario("Escribe por qué no se entregó.");
    await db.$transaction(async (tx) => {
      await registrarNoEntrega(tx, id, motivo, sesion.operacion === "REPARTIDOR" ? sesion.usuario.id : null);
      await auditar(tx, sesion.usuario.id, "Pedido", id, "no_entregado", { motivo });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/mi-ruta");
  return { ok: "Pedido marcado como no entregado." };
}

/** Crea un pedido nuevo, con los mismos productos y precios, para otro día. El original queda como no entregado. */
export async function reprogramarPedido(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pedidos.crear");
  let nuevoId: number;
  try {
    const fechaISO = texto(form, "fechaEntrega");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO) || fechaISO < hoyISO()) throw new ErrorUsuario("La fecha de entrega no es válida.");
    nuevoId = await db.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({ where: { id }, include: { detalles: true } });
      if (!pedido || pedido.estado !== "NO_ENTREGADO") throw new ErrorUsuario("Solo se reprograman pedidos no entregados.");
      const nuevo = await tx.pedido.create({
        data: {
          clienteId: pedido.clienteId,
          fechaEntrega: diaUTC(fechaISO),
          nota: [`Reprogramado del pedido #${id}`, pedido.nota].filter(Boolean).join(". "),
          creadoPorId: sesion.usuario.id,
          detalles: { create: pedido.detalles.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad, precioUnitario: d.precioUnitario })) },
        },
      });
      await auditar(tx, sesion.usuario.id, "Pedido", nuevo.id, "reprogramar", { desde: id, fecha: fechaISO });
      return nuevo.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect(`/pedidos/${nuevoId}?creado=1`);
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
