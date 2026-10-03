// El precio de un producto para un cliente: su precio especial o, si no tiene, el general.

export interface PrecioProducto {
  productoId: number;
  precioGeneral: number;
}

export function precioParaCliente(
  producto: PrecioProducto,
  especiales: ReadonlyMap<number, number>,
): number {
  return especiales.get(producto.productoId) ?? producto.precioGeneral;
}

export function totalPedido(lineas: { cantidad: number; precioUnitario: number }[]): number {
  return lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
}
