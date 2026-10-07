import type { Operacion } from "@/lib/permisos";
import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Paginacion, rango } from "@/components/paginacion";
import { Etiqueta, Tarjeta, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFecha, formatoHuevos, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { anularCompra } from "./compras";

/** Todas las compras de huevo (de contado y a crédito), de la más reciente a la más antigua. */
export async function HistorialCompras({ operacion, pagina, diaISO }: { operacion: Operacion; pagina: number; diaISO: string }) {
  const [compras, total] = await Promise.all([
    db.compra.findMany({
      orderBy: { id: "desc" },
      ...rango(pagina, 20),
      include: { proveedor: { select: { nombre: true } }, detalles: { include: { producto: { select: { nombre: true } } } } },
    }),
    db.compra.count(),
  ]);
  return (
    <Tarjeta id="historial" titulo={`Historial de compras (${total})`} className="mt-6">
        {compras.length === 0 ? (
          <Vacio>Todavía no hay compras.</Vacio>
        ) : (
          <ul className="space-y-2">
            {compras.map((c) => (
              <li key={c.id} className="rounded border border-stone-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>#{c.id}</strong> · {formatoFecha(c.fecha)} ·{" "}
                    <Link href={`/proveedores/${c.proveedorId}`} className="underline">
                      {c.proveedor.nombre}
                    </Link>{" "}
                    {c.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
                  </span>
                  <strong>{formatoPesos(c.total)}</strong>
                </div>
                <p>
                  {c.clasificada
                    ? c.detalles.map((d) => `${d.producto.nombre}: ${formatoHuevos(d.cantidad)}`).join(" · ")
                    : `Sin clasificar: ${formatoHuevos(c.huevos)}`}
                  {!c.anulada && !c.clasificada && c.porClasificar > 0 && (
                    <>
                      {" "}
                      <Etiqueta color="ambar">Faltan {formatoHuevos(c.porClasificar)} por clasificar</Etiqueta>
                    </>
                  )}
                </p>
                <p className="text-stone-600">
                  {c.formaPago === "CONTADO" ? "De contado" : `A crédito · debe ${formatoPesos(c.saldo)}`}
                  {c.nota && ` · ${c.nota}`}
                </p>
                {!c.anulada && puede(operacion, "anular") && (
                  <Formulario
                    accion={anularCompra.bind(null, c.id)}
                    confirmar="¿Anular esta compra? Sale del inventario y se devuelve el dinero a la caja."
                    className="mt-1"
                  >
                    <button type="submit" className="text-xs text-red-700 underline">
                      Anular compra
                    </button>
                  </Formulario>
                )}
              </li>
            ))}
          </ul>
        )}
      <Paginacion ruta="/egresos" params={{ dia: diaISO }} param="compras" pagina={pagina} total={total} porPagina={20} ancla="historial" />
    </Tarjeta>
  );
}
