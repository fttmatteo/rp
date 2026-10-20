import type { Operacion } from "@/lib/permisos";
import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Paginacion, rango } from "@/components/paginacion";
import { BotonTexto, Etiqueta, Tabla, Tarjeta, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFecha, formatoHuevos, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { nombreMes } from "@/modules/libro";
import { diasDelMes } from "@/components/historial-dinero";
import { anularCompra } from "./compras";

/** Las compras de huevo de un mes (de contado y a crédito), de la más reciente a la más antigua. */
export async function HistorialCompras({
  operacion,
  pagina,
  mes,
  params,
}: {
  operacion: Operacion;
  pagina: number;
  mes: string;
  /** Filtros de la URL que se conservan al cambiar de página. */
  params: Record<string, string | undefined>;
}) {
  // Los saldos iniciales de proveedores no son compras de huevo: se ven en Por pagar.
  const where = { tipo: "COMPRA" as const, dia: diasDelMes(mes) };
  const [compras, total] = await Promise.all([
    db.compra.findMany({
      where,
      orderBy: { id: "desc" },
      ...rango(pagina, 20),
      include: { proveedor: { select: { nombre: true } }, detalles: { include: { producto: { select: { nombre: true } } } } },
    }),
    db.compra.count({ where }),
  ]);
  return (
    <Tarjeta id="historial" titulo={`Compras de huevo de ${nombreMes(mes)} (${total})`}>
        {compras.length === 0 ? (
          <Vacio>No hay compras en este mes.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                {/* En el celular el huevo y el pago se esconden; la forma de pago y lo que falta por clasificar bajan debajo del proveedor. */}
                <th>Compra</th>
                <th>Proveedor</th>
                <th className="hidden sm:table-cell">Huevo</th>
                <th className="hidden sm:table-cell">Pago</th>
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
                    <span className="block text-stone-600 sm:hidden">
                      {c.formaPago === "CONTADO" ? "De contado" : `A crédito · debe ${formatoPesos(c.saldo)}`}
                    </span>
                    {!c.anulada && !c.clasificada && c.porClasificar > 0 && (
                      <span className="mt-1 block sm:hidden">
                        <Etiqueta color="azul">Faltan {formatoHuevos(c.porClasificar)} por clasificar</Etiqueta>
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell">
                    {c.clasificada
                      ? c.detalles.map((d) => `${d.producto.nombre}: ${formatoHuevos(d.cantidad)}`).join(" · ")
                      : `Sin clasificar: ${formatoHuevos(c.huevos)}`}
                    {!c.anulada && !c.clasificada && c.porClasificar > 0 && (
                      <>
                        {" "}
                        <Etiqueta color="azul">Faltan {formatoHuevos(c.porClasificar)} por clasificar</Etiqueta>
                      </>
                    )}
                    {c.nota && <span className="text-stone-500"> · {c.nota}</span>}
                  </td>
                  <td className="hidden text-stone-600 sm:table-cell">{c.formaPago === "CONTADO" ? "De contado" : `A crédito · debe ${formatoPesos(c.saldo)}`}</td>
                  <td className="text-right">
                    <strong className="whitespace-nowrap tabular-nums">{formatoPesos(c.total)}</strong>
                    {!c.anulada && puede(operacion, "anular") && (
                      <Formulario
                        accion={anularCompra.bind(null, c.id)}
                        confirmar="¿Anular esta compra? Sale del inventario y se devuelve el dinero a la caja."
                      >
                        <BotonTexto type="submit" peligro>
                          Anular
                        </BotonTexto>
                      </Formulario>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      <Paginacion ruta="/egresos" params={params} pagina={pagina} total={total} porPagina={20} />
    </Tarjeta>
  );
}
