// Líneas del recibo de venta a partir de lo que se entregó.
import { nombreProducto } from "@/lib/formato";

export interface LineaVenta {
  descripcion: string;
  cantidad?: number;
  precio?: number;
  valor: number;
}

interface DetalleVendido {
  cantidad: number;
  cantidadEntregada: number | null;
  precioUnitario: number;
  producto: { tipo: string; nombre: string; unidad?: string | null };
}

/**
 * El recibo cobra lo entregado, no lo pedido: en una entrega parcial cada línea lleva la
 * cantidad entregada y las que no se entregaron no aparecen. Sin pedido es un saldo inicial.
 */
export function lineasReciboVenta(detalles: DetalleVendido[] | null, venta: { total: number; nota: string | null }): LineaVenta[] {
  if (!detalles) return [{ descripcion: venta.nota ? `Saldo inicial: ${venta.nota}` : "Saldo inicial", valor: venta.total }];
  return detalles
    .map((d) => ({ d, cantidad: d.cantidadEntregada ?? d.cantidad }))
    .filter((l) => l.cantidad > 0)
    .map(({ d, cantidad }) => ({
      descripcion: d.producto.tipo === "CUBETA" ? `Cubeta x30 ${d.producto.nombre}` : nombreProducto(d.producto),
      cantidad,
      precio: d.precioUnitario,
      valor: cantidad * d.precioUnitario,
    }));
}
