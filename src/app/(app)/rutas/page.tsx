import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { leerFecha, SelectorDia } from "@/components/selector-dia";
import { Boton, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoPesos } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { totalPedido } from "@/modules/precios";
import { asignarPedidos } from "./acciones";

export default async function RutasPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  await requerir("rutas");
  const fecha = leerFecha((await searchParams).fecha);
  const dia = diaUTC(fecha);

  const [sinRuta, rutas, repartidores] = await Promise.all([
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
    db.usuario.findMany({ where: { activo: true, accesos: { has: "REPARTIDOR" } }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <>
      <Titulo>Rutas del {formatoDia(dia)}</Titulo>
      <SelectorDia ruta="/rutas" fecha={fecha} etiqueta="Fecha de entrega" />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Tarjeta titulo={`Pedidos sin ruta (${sinRuta.length})`}>
          {repartidores.length === 0 ? (
            <p className="text-sm text-stone-600">
              No hay usuarios con acceso de Repartidor. El administrador lo asigna en{" "}
              <Link href="/usuarios" className="underline">
                Usuarios
              </Link>
              .
            </p>
          ) : (
            // El formulario queda montado aunque ya no haya pedidos, para que se vea la confirmación.
            <Formulario accion={asignarPedidos.bind(null, fecha)} className="space-y-3">
              {sinRuta.length === 0 ? (
                <p className="text-sm text-stone-500">Todos los pedidos pendientes de ese día ya tienen ruta.</p>
              ) : (
                <>
                  <Tabla>
                    <thead>
                      <tr>
                        <th>
                          <span className="sr-only">Elegir</span>
                        </th>
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
                            <input
                              type="checkbox"
                              name="pedido"
                              value={p.id}
                              defaultChecked
                              aria-label={`Elegir pedido de ${p.cliente.nombre}`}
                            />
                          </td>
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
                  <div className="flex flex-wrap items-end gap-3">
                    <Campo etiqueta="Repartidor">
                      <select name="repartidorId" required>
                        {repartidores.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Boton type="submit">Asignar a su ruta</Boton>
                  </div>
                  <p className="text-xs text-stone-500">
                    Los pedidos marcados se agregan al final de la ruta del repartidor, agrupados por zona. Desmarca los que van con el otro
                    repartidor.
                  </p>
                </>
              )}
            </Formulario>
          )}
        </Tarjeta>

        <div className="space-y-3">
          <h2 className="font-semibold">Rutas</h2>
          {rutas.length === 0 && <Vacio>Todavía no hay rutas para ese día.</Vacio>}
          {rutas.map((r) => {
            const pendientes = r.pedidos.filter((p) => p.estado === "PENDIENTE").length;
            const valor = r.pedidos.reduce((s, p) => s + totalPedido(p.detalles), 0);
            return (
              <Link key={r.id} href={`/rutas/${r.id}`} className="block rounded border border-stone-200 bg-white p-4 hover:bg-stone-50">
                <span className="flex items-center justify-between gap-2">
                  <strong>{r.repartidor.nombre}</strong>
                  <Etiqueta color={r.estado === "LIQUIDADA" ? "verde" : "ambar"}>
                    {r.estado === "LIQUIDADA" ? "Liquidada" : "Abierta"}
                  </Etiqueta>
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
