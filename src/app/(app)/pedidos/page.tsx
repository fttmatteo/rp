import Link from "next/link";
import type { EstadoPedido, Prisma } from "@prisma/client";
import { BotonLink, Etiqueta, Tabla, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { totalPedido } from "@/modules/precios";

const ESTADOS: Record<EstadoPedido, { texto: string; color: "ambar" | "verde" | "gris" }> = {
  PENDIENTE: { texto: "Pendiente", color: "ambar" },
  ENTREGADO: { texto: "Entregado", color: "verde" },
  CANCELADO: { texto: "Cancelado", color: "gris" },
};

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ estado?: string; fecha?: string }> }) {
  const sesion = await requerir("pedidos.ver");
  const { estado = "PENDIENTE", fecha = "" } = await searchParams;
  const where: Prisma.PedidoWhereInput = {
    ...(estado in ESTADOS ? { estado: estado as EstadoPedido } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? { fechaEntrega: diaUTC(fecha) } : {}),
  };
  const pedidos = await db.pedido.findMany({
    where,
    orderBy: [{ fechaEntrega: estado === "PENDIENTE" ? "asc" : "desc" }, { id: "desc" }],
    take: 200,
    include: { cliente: true, detalles: { include: { producto: true } } },
  });

  return (
    <>
      <Titulo accion={puede(sesion.operacion, "pedidos.crear") && <BotonLink href="/pedidos/nuevo">Nuevo pedido</BotonLink>}>
        Pedidos
      </Titulo>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          Estado
          <select name="estado" defaultValue={estado} className="mt-1">
            <option value="PENDIENTE">Pendientes</option>
            <option value="ENTREGADO">Entregados</option>
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
              <th className="text-right">Total</th>
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
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </>
  );
}
