import Link from "next/link";
import type { EstadoPedido, Prisma } from "@prisma/client";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { BotonLink, Etiqueta, Tabla, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { ESTADO_PEDIDO, esParcial } from "@/lib/estados";
import { diaUTC, formatoDia, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { PestanasIngresos } from "@/components/secciones";
import { totalPedido } from "@/modules/precios";

const ESTADOS = ESTADO_PEDIDO;

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ estado?: string; fecha?: string; pagina?: string }> }) {
  const sesion = await requerir("pedidos.ver");
  const params = await searchParams;
  const { estado = "PENDIENTE", fecha = "" } = params;
  const pagina = leerPagina(params.pagina);
  const conFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const where: Prisma.PedidoWhereInput = {
    ...(estado in ESTADOS ? { estado: estado as EstadoPedido } : {}),
    ...(conFecha ? { fechaEntrega: diaUTC(fecha) } : {}),
  };
  const [pedidos, total, delDia] = await Promise.all([
    db.pedido.findMany({
      where,
      orderBy: [{ fechaEntrega: estado === "PENDIENTE" ? "asc" : "desc" }, { id: "desc" }],
      ...rango(pagina),
      include: { cliente: { select: { nombre: true } }, detalles: { include: { producto: true } } },
    }),
    db.pedido.count({ where }),
    // Con fecha elegida se suman las cantidades por clasificación y el valor de todo el día, no solo de esta página.
    conFecha
      ? db.detallePedido.findMany({
          where: { pedido: where },
          select: { cantidad: true, precioUnitario: true, producto: { select: { nombre: true, orden: true } } },
        })
      : [],
  ]);

  const totales = new Map<string, { orden: number; cantidad: number }>();
  for (const d of delDia) {
    const t = totales.get(d.producto.nombre) ?? { orden: d.producto.orden, cantidad: 0 };
    t.cantidad += d.cantidad;
    totales.set(d.producto.nombre, t);
  }
  const resumen = [...totales].sort((a, b) => a[1].orden - b[1].orden).map(([nombre, t]) => `${t.cantidad} ${nombre}`);
  const valorTotal = totalPedido(delDia);

  return (
    <>
      <Titulo accion={puede(sesion.operacion, "pedidos.crear") && <BotonLink href="/pedidos/nuevo">Nuevo pedido</BotonLink>}>
        Pedidos
      </Titulo>
      <PestanasIngresos actual="/pedidos" operacion={sesion.operacion} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          Estado
          <select name="estado" defaultValue={estado} className="mt-1">
            <option value="PENDIENTE">Pendientes</option>
            <option value="ENTREGADO">Entregados</option>
            <option value="NO_ENTREGADO">No entregados</option>
            <option value="CANCELADO">Cancelados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label>
          Fecha de entrega
          <input type="date" name="fecha" defaultValue={fecha} className="mt-1" />
        </label>
        <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
          Filtrar
        </button>
      </form>
      {pedidos.length === 0 ? (
        <Vacio>No hay pedidos con ese filtro.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>#</th>
              <th>Entrega</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th className="text-right">Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/pedidos/${p.id}`} className="underline">
                    {p.id}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatoDia(p.fechaEntrega)}</td>
                <td>{p.cliente.nombre}</td>
                <td className="text-stone-600">{p.detalles.map((d) => `${d.cantidad} ${d.producto.nombre}`).join(", ")}</td>
                <td className="text-right">{formatoPesos(totalPedido(p.detalles))}</td>
                <td>
                  <Etiqueta color={ESTADOS[p.estado].color}>{ESTADOS[p.estado].texto}</Etiqueta>
                  {p.estado === "ENTREGADO" && esParcial(p.detalles) && <span className="text-xs text-stone-500"> parcial</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {conFecha && (
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={3}>Total del día</td>
                <td>{resumen.join(", ")}</td>
                <td className="text-right">{formatoPesos(valorTotal)}</td>
                <td>
                  <Link href={`/reparto?fecha=${fecha}`} className="font-normal underline">
                    Ver resumen del reparto
                  </Link>
                </td>
              </tr>
            </tfoot>
          )}
        </Tabla>
      )}
      <Paginacion ruta="/pedidos" params={params} pagina={pagina} total={total} />
    </>
  );
}
