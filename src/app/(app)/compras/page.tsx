import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { BotonLink, Etiqueta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFecha, formatoHuevos, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { anularCompra } from "./acciones";

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const sesion = await requerir("compras");
  const pagina = leerPagina((await searchParams).pagina);
  const [compras, total] = await Promise.all([
    db.compra.findMany({
      orderBy: { id: "desc" },
      ...rango(pagina),
      include: { proveedor: { select: { nombre: true } }, detalles: { include: { producto: { select: { nombre: true } } } } },
    }),
    db.compra.count(),
  ]);

  return (
    <>
      <Titulo
        accion={
          <span className="flex gap-2">
            <BotonLink href="/egresos">Registrar compra</BotonLink>
            <BotonLink href="/proveedores" variante="secundario">
              Proveedores y cuentas por pagar
            </BotonLink>
          </span>
        }
      >
        Compras de huevo
      </Titulo>
      <p className="mb-4 text-sm text-stone-600">Historial de compras. Las compras nuevas se registran en Egresos, junto con los demás pagos.</p>
      {compras.length === 0 ? (
        <Vacio>Todavía no hay compras.</Vacio>
      ) : (
        <ul className="space-y-2">
          {compras.map((c) => (
            <li key={c.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
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
              {!c.anulada && puede(sesion.operacion, "anular") && (
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
      <Paginacion ruta="/compras" pagina={pagina} total={total} />
    </>
  );
}
