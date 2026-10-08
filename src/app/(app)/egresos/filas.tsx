import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import type { FilaDinero } from "@/components/dinero";

/** Lo que se carga de cada salida de dinero para mostrarla. */
export const incluirEgreso = {
  usuario: { select: { nombre: true } },
  compra: { select: { id: true, proveedorId: true } },
  pagoProveedor: { select: { proveedorId: true } },
} satisfies Prisma.MovimientoCajaInclude;

type Egreso = Prisma.MovimientoCajaGetPayload<{ include: typeof incluirEgreso }>;

/** Filtro de Prisma por tipo de salida (para el historial). */
export function whereTipoEgreso(tipo: string): Prisma.MovimientoCajaWhereInput {
  if (tipo === "compras") return { compraId: { not: null } };
  if (tipo === "pagos") return { pagoProveedorId: { not: null } };
  if (tipo === "faltantes") return { rutaId: { not: null } };
  if (tipo === "gastos") return { compraId: null, pagoProveedorId: null, rutaId: null };
  return {};
}

/** Una salida de dinero como fila de la lista del día o del historial. */
export function filaEgreso(m: Egreso, anular?: ReactNode): FilaDinero {
  const proveedorId = m.compra?.proveedorId ?? m.pagoProveedor?.proveedorId;
  return {
    clave: `m${m.id}`,
    fecha: m.fecha,
    origen: m.compraId ? "Compra" : m.pagoProveedorId ? "Pago a proveedor" : m.rutaId ? "Faltante de ruta" : "Gasto",
    detalle: proveedorId ? (
      <Link href={`/por-pagar/${proveedorId}`} className="underline">
        {m.concepto}
      </Link>
    ) : (
      m.concepto
    ),
    medio: m.medio,
    usuario: m.usuario.nombre,
    valor: m.valor,
    anulado: m.anulado,
    anular,
  };
}
