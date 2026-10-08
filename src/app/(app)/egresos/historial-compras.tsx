import type { Operacion } from "@/lib/permisos";
import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Paginacion, rango } from "@/components/paginacion";
import { Etiqueta, Tabla, Tarjeta, Vacio } from "@/components/ui";
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
    <Tarjeta id="historial" titulo={`Todas las compras (${total})`}>
        {compras.length === 0 ? (
          <Vacio>Todavía no hay compras.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Compra</th>
                <th>Proveedor</th>
                <th>Huevo</th>
                <th>Pago</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">
                    <strong>#{c.id}</strong> · {formatoFecha(c.fecha)} {c.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
                  </td>
                  <td>
                    <Link href={`/por-pagar/${c.proveedorId}`} className="underline">
                      {c.proveedor.nombre}
                    </Link>
                  </td>
                  <td>
                    {c.clasificada
                      ? c.detalles.map((d) => `${d.producto.nombre}: ${formatoHuevos(d.cantidad)}`).join(" · ")
                      : `Sin clasificar: ${formatoHuevos(c.huevos)}`}
                    {!c.anulada && !c.clasificada && c.porClasificar > 0 && (
                      <>
                        {" "}
                        <Etiqueta color="ambar">Faltan {formatoHuevos(c.porClasificar)} por clasificar</Etiqueta>
                      </>
                    )}
                    {c.nota && <span className="text-stone-500"> · {c.nota}</span>}
                  </td>
                  <td className="text-stone-600">{c.formaPago === "CONTADO" ? "De contado" : `A crédito · debe ${formatoPesos(c.saldo)}`}</td>
                  <td className="text-right">
                    <strong>{formatoPesos(c.total)}</strong>
                    {!c.anulada && puede(operacion, "anular") && (
                      <Formulario
                        accion={anularCompra.bind(null, c.id)}
                        confirmar="¿Anular esta compra? Sale del inventario y se devuelve el dinero a la caja."
                      >
                        <button type="submit" className="text-xs text-red-700 underline">
                          Anular
                        </button>
                      </Formulario>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      <Paginacion ruta="/egresos" params={{ dia: diaISO, ver: "historial" }} param="compras" pagina={pagina} total={total} porPagina={20} />
    </Tarjeta>
  );
}
