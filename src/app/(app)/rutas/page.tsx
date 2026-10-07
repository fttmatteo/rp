import Link from "next/link";
import { leerFecha, SelectorDia } from "@/components/selector-dia";
import { Etiqueta, Subnav, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { ESTADO_RUTA } from "@/lib/estados";
import { diaUTC, formatoDia, formatoPesos } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { PestanasRutas } from "@/components/secciones";
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
      <PestanasRutas actual="/rutas" operacion={sesion.operacion} fecha={fecha} />
      <SelectorDia ruta="/rutas" fecha={fecha} etiqueta="Fecha de entrega" />
      <Subnav
        enlaces={[
          { id: "sin-tomar", texto: `Pedidos sin tomar (${sinRuta.length})` },
          { id: "rutas", texto: `Rutas (${rutas.length})` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Tarjeta id="sin-tomar" titulo={`Pedidos sin tomar (${sinRuta.length})`}>
          {sinRuta.length === 0 ? (
            <p className="text-sm text-stone-500">Los repartidores ya tomaron todos los pedidos pendientes de ese día.</p>
          ) : (
            <>
              <Tabla>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Zona</th>
                    <th>Productos</th>
                    <th className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {sinRuta.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/pedidos/${p.id}`} className="underline">
                          {p.cliente.nombre}
                        </Link>
                      </td>
                      <td className="text-stone-600">{p.cliente.zona ?? "—"}</td>
                      <td className="text-stone-600">{p.detalles.map((d) => `${d.cantidad} ${d.producto.nombre}`).join(", ")}</td>
                      <td className="text-right">{formatoPesos(totalPedido(p.detalles))}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
              <p className="mt-2 text-xs text-stone-500">Cada repartidor toma los pedidos que va a llevar desde Mi ruta, el mismo día de la entrega.</p>
            </>
          )}
        </Tarjeta>

        <div className="space-y-3">
          <h2 id="rutas" className="font-semibold">
            Rutas
          </h2>
          {rutas.length === 0 && <Vacio>Todavía no hay rutas para ese día.</Vacio>}
          {rutas.map((r) => {
            const pendientes = r.pedidos.filter((p) => p.estado === "PENDIENTE").length;
            const valor = r.pedidos.reduce((s, p) => s + totalPedido(p.detalles), 0);
            return (
              <Link key={r.id} href={`/rutas/${r.id}`} className="block rounded border border-stone-200 bg-white p-4 hover:bg-stone-50">
                <span className="flex items-center justify-between gap-2">
                  <strong>{r.repartidor.nombre}</strong>
                  <Etiqueta color={ESTADO_RUTA[r.estado].color}>{ESTADO_RUTA[r.estado].texto}</Etiqueta>
                </span>
                <span className="block text-sm text-stone-600">
                  {r.pedidos.length} paradas · {pendientes} por entregar · {formatoPesos(valor)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
