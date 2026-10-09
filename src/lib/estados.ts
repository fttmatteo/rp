import type { EstadoPedido, EstadoRuta } from "@prisma/client";

export const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; color: "azul" | "verde" | "gris" | "rojo" }> = {
  PENDIENTE: { texto: "Pendiente", color: "azul" },
  ENTREGADO: { texto: "Entregado", color: "verde" },
  NO_ENTREGADO: { texto: "No entregado", color: "rojo" },
  CANCELADO: { texto: "Cancelado", color: "gris" },
};

/** Entregado con menos de lo pedido en alguna línea. */
export function esParcial(detalles: { cantidad: number; cantidadEntregada: number | null }[]): boolean {
  return detalles.some((d) => d.cantidadEntregada !== null && d.cantidadEntregada < d.cantidad);
}

export const ESTADO_RUTA: Record<EstadoRuta, { texto: string; color: "azul" | "verde" | "gris" | "rojo" }> = {
  ABIERTA: { texto: "Abierta", color: "azul" },
  PRECERRADA: { texto: "Por aprobar", color: "rojo" },
  LIQUIDADA: { texto: "Liquidada", color: "verde" },
};
