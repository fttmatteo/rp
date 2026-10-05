// Reparto por fecha: cuánto se lleva de cada clasificación, cuánto se cobró en
// la entrega y cuánto quedó pendiente (fiado).
import { totalPedido } from "./precios";

export interface LineaReparto {
  productoId: number;
  cantidad: number; // cubetas o gallinas
  precioUnitario: number;
}

export interface PagoEntrega {
  valor: number;
  medio: "EFECTIVO" | "TRANSFERENCIA";
}

export interface PedidoReparto {
  entregado: boolean;
  detalles: LineaReparto[];
  // Pagos hechos el mismo día de la entrega y aplicados a esa venta.
  pagos: PagoEntrega[];
}

export interface ValoresPedido {
  valor: number;
  pagado: number;
  pendiente: number;
}

/** Valor, pagado y pendiente de un pedido. Uno sin entregar todavía no tiene pago ni pendiente. */
export function valoresPedido(p: PedidoReparto): ValoresPedido {
  const valor = totalPedido(p.detalles);
  if (!p.entregado) return { valor, pagado: 0, pendiente: 0 };
  const pagado = p.pagos.reduce((s, x) => s + x.valor, 0);
  return { valor, pagado, pendiente: valor - pagado };
}

export interface CantidadProducto {
  productoId: number;
  entregado: number;
  porEntregar: number;
  valorEntregado: number;
}

export interface CierreReparto {
  porProducto: CantidadProducto[];
  valorEntregado: number;
  valorPorEntregar: number;
  pagadoEfectivo: number;
  pagadoTransferencia: number;
  pagado: number;
  pendiente: number;
}

/** Totales del reparto de un día: cantidades por clasificación, valor pagado y valor pendiente. */
export function cierreReparto(pedidos: PedidoReparto[]): CierreReparto {
  const porProducto = new Map<number, CantidadProducto>();
  const c: CierreReparto = {
    porProducto: [],
    valorEntregado: 0,
    valorPorEntregar: 0,
    pagadoEfectivo: 0,
    pagadoTransferencia: 0,
    pagado: 0,
    pendiente: 0,
  };
  for (const p of pedidos) {
    for (const d of p.detalles) {
      const fila = porProducto.get(d.productoId) ?? { productoId: d.productoId, entregado: 0, porEntregar: 0, valorEntregado: 0 };
      if (p.entregado) {
        fila.entregado += d.cantidad;
        fila.valorEntregado += d.cantidad * d.precioUnitario;
      } else {
        fila.porEntregar += d.cantidad;
      }
      porProducto.set(d.productoId, fila);
    }
    const v = valoresPedido(p);
    if (!p.entregado) {
      c.valorPorEntregar += v.valor;
      continue;
    }
    c.valorEntregado += v.valor;
    c.pendiente += v.pendiente;
    for (const pago of p.pagos) {
      if (pago.medio === "EFECTIVO") c.pagadoEfectivo += pago.valor;
      else c.pagadoTransferencia += pago.valor;
    }
  }
  c.pagado = c.pagadoEfectivo + c.pagadoTransferencia;
  c.porProducto = [...porProducto.values()];
  return c;
}
