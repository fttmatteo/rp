// Reparto por fecha: cuánto se lleva de cada clasificación, cuánto se entregó y
// se devolvió, cuánto se cobró en la entrega y cuánto quedó pendiente (fiado).
import { totalPedido } from "./precios";

export interface LineaReparto {
  productoId: number;
  cantidad: number; // cubetas o gallinas pedidas
  precioUnitario: number;
  // Lo que realmente se entregó; null o ausente = se entregó completo.
  cantidadEntregada?: number | null;
}

export interface PagoEntrega {
  valor: number;
  medio: "EFECTIVO" | "TRANSFERENCIA";
}

export interface PedidoReparto {
  entregado: boolean;
  // El repartidor no lo pudo entregar: todo vuelve.
  noEntregado?: boolean;
  detalles: LineaReparto[];
  // Pagos hechos el mismo día de la entrega y aplicados a esa venta.
  pagos: PagoEntrega[];
}

export interface ValoresPedido {
  valor: number;
  pagado: number;
  pendiente: number;
}

export function cantidadEntregada(l: LineaReparto): number {
  return l.cantidadEntregada ?? l.cantidad;
}

/** Valor de lo entregado (con entrega parcial, solo lo que recibió el cliente). */
export function valorEntregado(lineas: LineaReparto[]): number {
  return lineas.reduce((s, l) => s + cantidadEntregada(l) * l.precioUnitario, 0);
}

/** Valor, pagado y pendiente de un pedido. Uno sin entregar todavía no tiene pago ni pendiente. */
export function valoresPedido(p: PedidoReparto): ValoresPedido {
  if (!p.entregado) return { valor: p.noEntregado ? 0 : totalPedido(p.detalles), pagado: 0, pendiente: 0 };
  const valor = valorEntregado(p.detalles);
  const pagado = p.pagos.reduce((s, x) => s + x.valor, 0);
  return { valor, pagado, pendiente: valor - pagado };
}

export interface CantidadProducto {
  productoId: number;
  llevado: number;
  entregado: number;
  porEntregar: number;
  devuelto: number;
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
  entregados: number;
  noEntregados: number;
}

/** Totales del reparto: cantidades por clasificación, valor pagado y valor pendiente. */
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
    entregados: 0,
    noEntregados: 0,
  };
  for (const p of pedidos) {
    for (const d of p.detalles) {
      const fila = porProducto.get(d.productoId) ?? {
        productoId: d.productoId,
        llevado: 0,
        entregado: 0,
        porEntregar: 0,
        devuelto: 0,
        valorEntregado: 0,
      };
      fila.llevado += d.cantidad;
      if (p.entregado) {
        const entregada = cantidadEntregada(d);
        fila.entregado += entregada;
        fila.devuelto += d.cantidad - entregada;
        fila.valorEntregado += entregada * d.precioUnitario;
      } else if (p.noEntregado) {
        fila.devuelto += d.cantidad;
      } else {
        fila.porEntregar += d.cantidad;
      }
      porProducto.set(d.productoId, fila);
    }
    if (p.noEntregado) {
      c.noEntregados++;
      continue;
    }
    const v = valoresPedido(p);
    if (!p.entregado) {
      c.valorPorEntregar += v.valor;
      continue;
    }
    c.entregados++;
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
