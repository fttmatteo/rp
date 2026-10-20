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

/**
 * Qué guardar de un campo cuando la página pudo quedar vieja (otra persona guardó mientras tanto).
 * Lo que la persona no tocó conserva lo que hay en la base; lo que sí tocó se guarda, salvo que otra persona
 * también lo haya cambiado a otro valor: eso es un choque y no se pisa. Sin `antes` se guarda lo escrito.
 */
export function valorAGuardar<T>(escrito: T, antes: T | undefined, actual: T): { valor: T; choque: boolean } {
  if (antes === undefined || escrito === actual) return { valor: escrito, choque: false };
  if (escrito === antes) return { valor: actual, choque: false };
  return { valor: escrito, choque: actual !== antes };
}
