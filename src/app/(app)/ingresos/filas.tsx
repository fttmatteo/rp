import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import type { FilaDinero } from "@/components/dinero";
import { formatoConsecutivo } from "@/lib/formato";

/** Lo que se carga de cada pago de cliente para mostrarlo. */
export const incluirPago = {
  cliente: { select: { nombre: true } },
  usuario: { select: { nombre: true } },
  aplicaciones: { include: { venta: { select: { consecutivo: true, pedidoId: true, fecha: true } } } },
} satisfies Prisma.PagoInclude;

type PagoFila = Prisma.PagoGetPayload<{ include: typeof incluirPago }>;
type IngresoFila = Prisma.MovimientoCajaGetPayload<{ include: { usuario: { select: { nombre: true } } } }>;

/** Venta (cobro al vender en el punto), Cobro en ruta o Abono a deudas anteriores. */
export function origenPago(p: PagoFila): "Venta" | "Cobro en ruta" | "Abono" {
  if (p.rutaId) return "Cobro en ruta";
  // Cobro de una venta del mismo pago (al entregar) o abono a deudas anteriores.
  const deVenta = p.aplicaciones.some((a) => a.venta.pedidoId !== null && a.venta.fecha.getTime() >= p.fecha.getTime() - 60_000);
  return deVenta ? "Venta" : "Abono";
}

export function filaPago(p: PagoFila): FilaDinero {
  const recibos = p.aplicaciones.map((a) => a.venta).sort((a, b) => a.consecutivo - b.consecutivo);
  return {
    clave: `p${p.id}`,
    fecha: p.fecha,
    origen: origenPago(p),
    detalle: (
      <>
        <a href={`/recibos/pago/${p.id}`} target="_blank" className="underline">
          {formatoConsecutivo("AB", p.consecutivo)}
        </a>{" "}
        {p.cliente.nombre}
        {recibos.length > 0 && (
          <span className="text-stone-500">
            {" "}
            · a{" "}
            {recibos.map((v, i) => (
              <span key={v.consecutivo}>
                {i > 0 && ", "}
                {formatoConsecutivo("RP", v.consecutivo)}
              </span>
            ))}
          </span>
        )}
      </>
    ),
    medio: p.medio,
    usuario: p.usuario.nombre,
    valor: p.valor,
    anulado: p.anulado,
  };
}

export function filaIngreso(m: IngresoFila, anular?: ReactNode): FilaDinero {
  return {
    clave: `m${m.id}`,
    fecha: m.fecha,
    origen: m.rutaId ? "Sobrante de ruta" : "Otro ingreso",
    detalle: m.concepto,
    medio: m.medio,
    usuario: m.usuario.nombre,
    valor: m.valor,
    anulado: m.anulado,
    anular,
  };
}
