import Link from "next/link";
import { leerFecha, SelectorDia } from "@/components/selector-dia";
import { Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { ESTADO_RUTA } from "@/lib/estados";
import { diaUTC, formatoDia, formatoPesos } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { normalizar } from "@/lib/texto";
import { Buscador } from "@/components/buscador";
import { PestanasPedidos } from "@/components/secciones";
import { totalPedido } from "@/modules/precios";

export default async function RutasPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const sesion = await requerir("rutas");
  const fecha = leerFecha((await searchParams).fecha);
  const dia = diaUTC(fecha);

  const [sinRuta, rutas] = await Promise.all([
    db.pedido.findMany({
      where: { fechaEntrega: dia, estado: "PENDIENTE", rutaId: null },
      orderBy: [{ cliente: { zona: "asc" } }, { cliente: { nombre: "asc" } }],
      include: { cliente: true, detalles: { include: { producto: true } } },
    }),
    db.ruta.findMany({
      where: { fecha: dia },
      orderBy: { repartidor: { nombre: "asc" } },
      include: { repartidor: true, pedidos: { where: { estado: { not: "CANCELADO" } }, include: { detalles: true } } },
    }),
  ]);

  return (
    <>
      <Titulo>Rutas del {formatoDia(dia)}</Titulo>
      <PestanasPedidos actual="/rutas" operacion={sesion.operacion} fecha={fecha} />
      <SelectorDia ruta="/rutas" fecha={fecha} etiqueta="Fecha de entrega" />
      {/* Primero las rutas (pocas y es lo que se revisa); debajo, a todo el ancho, los pedidos que nadie ha tomado. */}
      <section id="rutas" className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Rutas ({rutas.length})</h2>
        {rutas.length === 0 ? (
          <Vacio>Todavía no hay rutas para ese día.</Vacio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rutas.map((r) => {
              const pendientes = r.pedidos.filter((p) => p.estado === "PENDIENTE").length;
              const valor = r.pedidos.reduce((s, p) => s + totalPedido(p.detalles), 0);
              return (
                <Link key={r.id} href={`/rutas/${r.id}`} className="block rounded border border-stone-200 bg-white p-4 hover:bg-stone-50">
                  <span className="flex items-center justify-between gap-2">
                    <strong>{r.repartidor.nombre}</strong>
                    <Etiqueta color={ESTADO_RUTA[r.estado].color}>{ESTADO_RUTA[r.estado].texto}</Etiqueta>
                  </span>
                  <span className="mt-1 block text-stone-600">
                    {r.pedidos.length} paradas · {pendientes} por entregar · <span className="tabular-nums">{formatoPesos(valor)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <Tarjeta id="sin-tomar" titulo={`Pedidos sin tomar (${sinRuta.length})`}>
        {sinRuta.length === 0 ? (
          <p className="text-stone-500">Los repartidores ya tomaron todos los pedidos pendientes de ese día.</p>
        ) : (
          <>
            <div className="mb-3">
              <Buscador objetivo="sin-tomar" placeholder="Buscar cliente o zona" />
            </div>
            <Tabla>
              <thead>
                <tr>
                  {/* En el celular la zona baja debajo del cliente y los productos se esconden, para no desplazar de lado. */}
                  <th>Cliente</th>
                  <th className="hidden sm:table-cell">Zona</th>
                  <th className="hidden sm:table-cell">Productos</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {sinRuta.map((p) => (
                  <tr key={p.id} data-buscar={normalizar(`${p.cliente.nombre} ${p.cliente.zona ?? ""}`)}>
                    <td>
                      <Link href={`/pedidos/${p.id}`} className="underline">
                        {p.cliente.nombre}
                      </Link>
                      {p.cliente.zona && <span className="block text-stone-600 sm:hidden">{p.cliente.zona}</span>}
                    </td>
                    <td className="hidden text-stone-600 sm:table-cell">{p.cliente.zona ?? "—"}</td>
                    <td className="hidden text-stone-600 sm:table-cell">{p.detalles.map((d) => `${d.cantidad} ${d.producto.nombre}`).join(", ")}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatoPesos(totalPedido(p.detalles))}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            <p className="mt-2 text-sm text-stone-500">Cada repartidor toma los pedidos que va a llevar desde Mi ruta, el mismo día de la entrega.</p>
          </>
        )}
      </Tarjeta>
    </>
  );
}
