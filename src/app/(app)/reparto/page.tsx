import Link from "next/link";
import { leerFecha, SelectorDia } from "@/components/selector-dia";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Etiqueta, Subnav, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { esParcial } from "@/lib/estados";
import { diaUTC, formatoDia, formatoPesos, hoyISO } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { PestanasRutas } from "@/components/secciones";
import { cierreReparto, valoresPedido, type PedidoReparto } from "@/modules/reparto";

export default async function RepartoPage({ searchParams }: { searchParams: Promise<{ fecha?: string; ruta?: string; pagina?: string }> }) {
  const sesion = await requerir("pedidos.ver");
  const { fecha: f, ruta: rutaParam = "", pagina: paginaParam } = await searchParams;
  const pagina = leerPagina(paginaParam);
  const fecha = leerFecha(f);
  const rutas = await db.ruta.findMany({ where: { fecha: diaUTC(fecha) }, include: { repartidor: true }, orderBy: { repartidor: { nombre: "asc" } } });
  // Filtro por ruta (requerimiento 4): todas, una ruta o los pedidos sin ruta.
  const rutaElegida = rutas.find((r) => String(r.id) === rutaParam);
  const filtroRuta = rutaParam === "sin" ? { rutaId: null } : rutaElegida ? { rutaId: rutaElegida.id } : {};

  const [pedidos, productos] = await Promise.all([
    db.pedido.findMany({
      where: { fechaEntrega: diaUTC(fecha), estado: { not: "CANCELADO" }, ...filtroRuta },
      orderBy: [{ cliente: { zona: "asc" } }, { cliente: { nombre: "asc" } }, { id: "asc" }],
      include: {
        cliente: true,
        detalles: true,
        venta: { include: { aplicaciones: { include: { pago: true } } } },
      },
    }),
    db.producto.findMany({ orderBy: { orden: "asc" } }),
  ]);
  const hoy = hoyISO();
  const nombres = new Map(productos.map((p) => [p.id, p.nombre]));
  const orden = new Map(productos.map((p) => [p.id, p.orden]));

  const filas = pedidos.map((p) => {
    const venta = p.venta && !p.venta.anulada ? p.venta : null;
    // Lo pagado en la entrega: pagos de ese mismo día aplicados a la venta.
    // Los abonos de días siguientes no cambian el reparto del día.
    const diaVenta = venta ? hoyISO(venta.fecha) : null;
    const reparto: PedidoReparto = {
      entregado: p.estado === "ENTREGADO" && venta !== null,
      noEntregado: p.estado === "NO_ENTREGADO",
      detalles: p.detalles,
      pagos: venta
        ? venta.aplicaciones
            .filter((a) => !a.pago.anulado && a.pago.dia.toISOString().slice(0, 10) === diaVenta)
            .map((a) => ({ valor: a.valor, medio: a.pago.medio }))
        : [],
    };
    return { pedido: p, reparto, valores: valoresPedido(reparto) };
  });
  const cierre = cierreReparto(filas.map((f) => f.reparto));
  const porProducto = [...cierre.porProducto].sort((a, b) => (orden.get(a.productoId) ?? 0) - (orden.get(b.productoId) ?? 0));

  return (
    <>
      <Titulo>
        Resumen del reparto del {formatoDia(diaUTC(fecha))}
        {rutaElegida && ` · ruta de ${rutaElegida.repartidor.nombre}`}
        {rutaParam === "sin" && " · sin ruta"}
      </Titulo>
      <PestanasRutas actual="/reparto" operacion={sesion.operacion} fecha={fecha} />
      <SelectorDia ruta="/reparto" fecha={fecha} etiqueta="Fecha de entrega">
        {rutas.length > 0 && (
          <label>
            Ruta
            <select name="ruta" defaultValue={rutaElegida ? String(rutaElegida.id) : rutaParam === "sin" ? "sin" : ""} className="mt-1">
              <option value="">Todas</option>
              {rutas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.repartidor.nombre}
                </option>
              ))}
              <option value="sin">Sin ruta</option>
            </select>
          </label>
        )}
      </SelectorDia>
      {rutaElegida && (
        <p className="mb-4 text-sm">
          La liquidación de esta ruta (efectivo entregado y devoluciones) está en{" "}
          <Link href={`/rutas/${rutaElegida.id}`} className="underline">
            la ruta de {rutaElegida.repartidor.nombre}
          </Link>
          .
        </p>
      )}
      {fecha > hoy && (
        <p className="mb-4 text-sm text-stone-600">Reparto programado: son los pedidos creados para esa fecha. Se entregan y cobran ese día.</p>
      )}

      <Subnav
        enlaces={[
          filas.length > 0 && { id: "pedidos", texto: `Pedidos (${filas.length})` },
          filas.length > 0 && { id: "cierre", texto: "Cierre del reparto" },
        ]}
      />
      {filas.length === 0 ? (
        <Vacio>No hay pedidos para entregar ese día.</Vacio>
      ) : (
        <>
          <div id="pedidos" />
          <Tabla>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Clasificación y cantidad</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Pagado</th>
                <th className="text-right">Pendiente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {paginar(filas, pagina).map(({ pedido: p, reparto, valores }) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pedidos/${p.id}`} className="underline">
                      {p.cliente.nombre}
                    </Link>
                    {p.cliente.zona && <span className="block text-xs text-stone-500">{p.cliente.zona}</span>}
                  </td>
                  <td className="text-stone-600">
                    {p.detalles.map((d) => `${reparto.entregado ? (d.cantidadEntregada ?? d.cantidad) : d.cantidad} ${nombres.get(d.productoId)}`).join(", ")}
                  </td>
                  <td className="text-right">{formatoPesos(valores.valor)}</td>
                  <td className="text-right">{reparto.entregado ? formatoPesos(valores.pagado) : "–"}</td>
                  <td className={`text-right ${valores.pendiente > 0 ? "text-red-700" : ""}`}>
                    {reparto.entregado ? formatoPesos(valores.pendiente) : "–"}
                  </td>
                  <td>
                    {reparto.entregado ? (
                      <Etiqueta color="verde">Entregado{esParcial(p.detalles) && " parcial"}</Etiqueta>
                    ) : reparto.noEntregado ? (
                      <Etiqueta color="rojo">No entregado</Etiqueta>
                    ) : (
                      <Etiqueta color="ambar">Por entregar</Etiqueta>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <Paginacion ruta="/reparto" params={{ fecha, ruta: rutaParam }} pagina={pagina} total={filas.length} ancla="pedidos" />
          <p className="mt-2 text-xs text-stone-500">
            Pagado es lo que el cliente pagó el día de la entrega. Lo que no pagó queda como pendiente (fiado) y se ve en su cartera.
          </p>

          <h2 id="cierre" className="mb-3 mt-6 text-lg font-semibold">
            Cierre del reparto
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Cantidad por clasificación">
              <Tabla>
                <thead>
                  <tr>
                    <th>Clasificación</th>
                    <th className="text-right">Entregado</th>
                    <th className="text-right">Devuelto</th>
                    <th className="text-right">Por entregar</th>
                    <th className="text-right">Valor entregado</th>
                  </tr>
                </thead>
                <tbody>
                  {porProducto.map((c) => (
                    <tr key={c.productoId}>
                      <td>{nombres.get(c.productoId)}</td>
                      <td className="text-right">{c.entregado}</td>
                      <td className="text-right">{c.devuelto}</td>
                      <td className="text-right">{c.porEntregar}</td>
                      <td className="text-right">{formatoPesos(c.valorEntregado)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
              <p className="mt-2 text-xs text-stone-500">Cubetas de 30 huevos; gallinas por unidad. Devuelto: entregas parciales y pedidos no entregados.</p>
            </Tarjeta>
            <Tarjeta titulo="Valores">
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt>Valor entregado</dt>
                <dd className="text-right">{formatoPesos(cierre.valorEntregado)}</dd>
                <dt>Pagado en efectivo</dt>
                <dd className="text-right">{formatoPesos(cierre.pagadoEfectivo)}</dd>
                <dt>Pagado por transferencia</dt>
                <dd className="text-right">{formatoPesos(cierre.pagadoTransferencia)}</dd>
                <dt className="font-semibold">Valor pagado</dt>
                <dd className="text-right font-semibold">{formatoPesos(cierre.pagado)}</dd>
                <dt className="font-semibold">Valor pendiente</dt>
                <dd className={`text-right font-semibold ${cierre.pendiente > 0 ? "text-red-700" : ""}`}>{formatoPesos(cierre.pendiente)}</dd>
                {cierre.valorPorEntregar > 0 && (
                  <>
                    <dt className="text-stone-500">Falta por entregar</dt>
                    <dd className="text-right text-stone-500">{formatoPesos(cierre.valorPorEntregar)}</dd>
                  </>
                )}
              </dl>
            </Tarjeta>
          </div>
        </>
      )}
    </>
  );
}
