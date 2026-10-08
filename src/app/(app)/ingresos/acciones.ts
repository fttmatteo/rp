"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { registrarEntrega } from "@/lib/entregas";
import { diaUTC, formatoConsecutivo, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, textoOpcional, type EstadoForm } from "@/lib/form";
import { abonar, leerMedio } from "@/lib/pagos";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { precioParaCliente, totalPedido } from "@/modules/precios";

function refrescar() {
  revalidatePath("/ingresos");
  revalidatePath("/caja");
}

/**
 * Venta en la granja: crea el pedido ya entregado en un solo paso (recibo, inventario y cobro).
 * Valor pagado vacío = paga todo; lo que no pague queda como fiado.
 */
export async function registrarVentaDirecta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pedidos.crear");
  if (!puede(sesion.operacion, "pedidos.entregar")) return { error: "No tienes permiso para entregar pedidos." };
  let consecutivo: number;
  try {
    const clienteId = entero(form, "clienteId", "Cliente");
    const cliente = clienteId ? await db.cliente.findUnique({ where: { id: clienteId }, include: { precios: true } }) : null;
    if (!cliente || !cliente.activo) throw new ErrorUsuario("Elige el cliente.");

    const productos = await db.producto.findMany({ where: { activo: true } });
    const especiales = new Map(cliente.precios.map((p) => [p.productoId, p.precio]));
    const detalles = productos
      .map((p) => ({
        productoId: p.id,
        cantidad: entero(form, `cantidad_${p.id}`, `Cantidad de ${p.nombre}`) ?? 0,
        precioUnitario: precioParaCliente({ productoId: p.id, precioGeneral: p.precioGeneral }, especiales),
      }))
      .filter((d) => d.cantidad > 0);
    if (detalles.length === 0) throw new ErrorUsuario("Escribe al menos una cantidad.");
    const total = totalPedido(detalles);
    const pagado = entero(form, "pagado", "Valor pagado") ?? total;
    const { medio, referencia } = leerMedio(form);

    consecutivo = await db.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          clienteId: cliente.id,
          fechaEntrega: diaUTC(hoyISO()),
          nota: textoOpcional(form, "nota") ?? "Venta en la granja",
          creadoPorId: sesion.usuario.id,
          detalles: { create: detalles },
        },
      });
      const r = await registrarEntrega(tx, {
        pedidoId: pedido.id,
        usuarioId: sesion.usuario.id,
        entregadas: new Map(),
        pago: pagado > 0 ? { valor: pagado, medio, referencia } : null,
        repartidorId: null,
      });
      await auditar(tx, sesion.usuario.id, "Venta", r.venta.id, "venta directa", { pedidoId: pedido.id, total: r.total, pagado });
      return r.venta.consecutivo;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  revalidatePath("/pedidos");
  return { ok: `Venta ${formatoConsecutivo("RP", consecutivo)} registrada. El recibo está en las entradas del día.` };
}

/** Abono de un cliente elegido de la lista, a sus deudas más antiguas. */
export async function registrarAbonoCliente(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pagos.registrar");
  // Lo que cobra el repartidor debe quedar en su ruta para que la liquidación se lo cobre.
  if (sesion.operacion === "REPARTIDOR") return { error: "Registra el abono desde la parada del cliente en Mi ruta." };
  try {
    const clienteId = entero(form, "clienteId", "Cliente");
    if (!clienteId) throw new ErrorUsuario("Elige el cliente.");
    const valor = entero(form, "valor", "Valor") ?? 0;
    const { medio, referencia } = leerMedio(form);
    await db.$transaction(async (tx) => {
      const { pago, aplicaciones } = await abonar(tx, { clienteId, usuarioId: sesion.usuario.id, valor, medio, referencia, ventaId: null });
      await auditar(tx, sesion.usuario.id, "Pago", pago.id, "abono", { valor, medio, aplicaciones });
    });
    revalidatePath(`/cartera/${clienteId}`);
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Abono registrado. El recibo está en las entradas del día." };
}
