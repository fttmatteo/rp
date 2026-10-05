import "server-only";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import type { Tx } from "@/lib/db";
import { bloquearCliente, bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { entero, ErrorUsuario } from "@/lib/form";
import { diaUTC, formatoCantidad, hoyISO, sumarDias } from "@/lib/formato";
import { abonar, type Medio } from "@/lib/pagos";
import { exigirRutaAbierta } from "@/lib/rutas-db";
import { faltantes, unidadesInventario } from "@/modules/inventario";
import { validarEntregadas } from "@/modules/rutas";

/** Cantidades escritas en los campos entregada_<id del detalle>; vacío = se entregó completo. */
export function leerEntregadas(form: FormData): Map<number, number | null> {
  const entregadas = new Map<number, number | null>();
  for (const campo of form.keys()) {
    const m = /^entregada_(\d+)$/.exec(campo);
    if (m) entregadas.set(Number(m[1]), entero(form, campo, "Cantidad entregada"));
  }
  return entregadas;
}

export interface DatosEntrega {
  pedidoId: number;
  usuarioId: number;
  // Cantidad entregada por línea (id del detalle); las que falten se entregan completas.
  entregadas: ReadonlyMap<number, number | null>;
  pago: { valor: number; medio: Medio; referencia: string | null } | null;
  // Si lo registra un repartidor, solo puede entregar pedidos de su propia ruta.
  repartidorId: number | null;
}

/** Pedido pendiente bloqueado para el cliente y, si va en ruta, con la ruta abierta y del repartidor. */
async function pedidoParaEntregar(tx: Tx, pedidoId: number, repartidorId: number | null) {
  const pedido = await tx.pedido.findUnique({
    where: { id: pedidoId },
    include: { detalles: { include: { producto: true }, orderBy: { id: "asc" } }, cliente: true },
  });
  if (!pedido) throw new ErrorUsuario("Pedido no encontrado.");
  await bloquearCliente(tx, pedido.clienteId);
  if (pedido.rutaId) {
    const ruta = await exigirRutaAbierta(tx, pedido.rutaId);
    if (repartidorId !== null && ruta.repartidorId !== repartidorId)
      throw new ErrorUsuario("Este pedido está en la ruta de otro repartidor.");
  }
  return pedido;
}

/**
 * Entrega un pedido: crea la venta con su recibo por lo entregado, descuenta el inventario
 * y registra lo que el cliente pagó. Si paga más que la venta, el resto abona a sus deudas
 * anteriores, empezando por la más antigua. Lo que no pagó queda como fiado.
 */
export async function registrarEntrega(tx: Tx, d: DatosEntrega) {
  const pedido = await pedidoParaEntregar(tx, d.pedidoId, d.repartidorId);
  const marcado = await tx.pedido.updateMany({ where: { id: d.pedidoId, estado: "PENDIENTE" }, data: { estado: "ENTREGADO" } });
  if (marcado.count === 0) throw new ErrorUsuario("Este pedido ya no está pendiente.");

  const entregadas = validarEntregadas(
    pedido.detalles.map((l) => ({ id: l.id, cantidad: l.cantidad, nombre: l.producto.nombre })),
    d.entregadas,
  );
  const lineas = pedido.detalles.map((l) => ({ ...l, entregada: entregadas.get(l.id)! }));
  for (const l of lineas) await tx.detallePedido.update({ where: { id: l.id }, data: { cantidadEntregada: l.entregada } });
  const total = lineas.reduce((s, l) => s + l.entregada * l.precioUnitario, 0);

  const salidas = lineas
    .filter((l) => l.entregada > 0)
    .map((l) => ({ productoId: l.productoId, unidades: unidadesInventario(l.producto.tipo, l.entregada) }));
  const falta = faltantes(
    salidas,
    await bloquearExistencias(
      tx,
      salidas.map((s) => s.productoId),
    ),
  );
  if (falta.length > 0) {
    const productos = new Map(lineas.map((l) => [l.productoId, l.producto]));
    const detalle = falta
      .map((f) => {
        const p = productos.get(f.productoId)!;
        return `${p.nombre} (hay ${formatoCantidad(p.tipo, f.disponible, p.unidad)})`;
      })
      .join(", ");
    throw new ErrorUsuario(`No hay inventario suficiente: ${detalle}.`);
  }

  const venta = await tx.venta.create({
    data: {
      consecutivo: await siguienteConsecutivo(tx, "VENTA"),
      pedidoId: d.pedidoId,
      clienteId: pedido.clienteId,
      total,
      saldo: total,
      vence: sumarDias(diaUTC(hoyISO()), pedido.cliente.diasCredito),
      usuarioId: d.usuarioId,
    },
  });
  await registrarMovimientos(
    tx,
    salidas.map((s) => ({
      productoId: s.productoId,
      cantidad: -s.unidades,
      tipo: "VENTA" as const,
      ventaId: venta.id,
      usuarioId: d.usuarioId,
    })),
  );
  const pago =
    d.pago && d.pago.valor > 0
      ? await abonar(tx, { clienteId: pedido.clienteId, usuarioId: d.usuarioId, ...d.pago, ventaId: venta.id, rutaId: pedido.rutaId })
      : null;
  return { venta, pago: pago?.pago ?? null, total, parcial: lineas.some((l) => l.entregada < l.cantidad) };
}

/** El repartidor no pudo entregar: el pedido queda como no entregado, con el motivo. */
export async function registrarNoEntrega(tx: Tx, pedidoId: number, motivo: string, repartidorId: number | null) {
  await pedidoParaEntregar(tx, pedidoId, repartidorId);
  const r = await tx.pedido.updateMany({
    where: { id: pedidoId, estado: "PENDIENTE" },
    data: { estado: "NO_ENTREGADO", motivoNoEntrega: motivo },
  });
  if (r.count === 0) throw new ErrorUsuario("Este pedido ya no está pendiente.");
}
