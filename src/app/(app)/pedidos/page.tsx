import Link from "next/link";
import type { EstadoPedido, Prisma } from "@prisma/client";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { Boton, BotonLink, Etiqueta, Tabla, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { ESTADO_PEDIDO, esParcial } from "@/lib/estados";
import { diaUTC, formatoDia, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { generarPedidosRecurrentes } from "@/lib/recurrentes-db";
import { requerir } from "@/lib/sesion";
import { PestanasPedidos } from "@/components/secciones";
import { totalPedido } from "@/modules/precios";
import { aprobarPedidosDeHoy } from "./acciones";

const ESTADOS = ESTADO_PEDIDO;

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ estado?: string; fecha?: string; q?: string; pagina?: string }> }) {
  const sesion = await requerir("pedidos.ver");
  // Los pedidos recurrentes de hoy se cargan al abrir la lista.
  await generarPedidosRecurrentes();
  const params = await searchParams;
  const { estado = "PENDIENTE", fecha = "" } = params;
  const q = (params.q ?? "").trim();
  const pagina = leerPagina(params.pagina);
  const conFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const where: Prisma.PedidoWhereInput = {
    ...(estado in ESTADOS ? { estado: estado as EstadoPedido } : {}),
    ...(conFecha ? { fechaEntrega: diaUTC(fecha) } : {}),
    ...(q ? { cliente: { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { zona: { contains: q, mode: "insensitive" } }] } } : {}),
  };
  const hoy = diaUTC(hoyISO());
  const [pedidos, total, delDia, porAprobarHoy] = await Promise.all([
    db.pedido.findMany({
      where,
      orderBy: [{ fechaEntrega: estado === "PENDIENTE" || estado === "POR_APROBAR" ? "asc" : "desc" }, { id: "desc" }],
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
    db.pedido.count({ where: { estado: "POR_APROBAR", fechaEntrega: hoy } }),
  ]);

  const totales = new Map<string, { orden: number; cantidad: number }>();
  for (const d of delDia) {
    const t = totales.get(d.producto.nombre) ?? { orden: d.producto.orden, cantidad: 0 };
    t.cantidad += d.cantidad;
    totales.set(d.producto.nombre, t);
  }
  const resumen = [...totales].sort((a, b) => a[1].orden - b[1].orden).map(([nombre, t]) => `${t.cantidad} ${nombre}`);
  const valorTotal = totalPedido(delDia);
  const op = sesion.operacion;
  const vender = puede(op, "caja") && puede(op, "pedidos.crear") && puede(op, "pedidos.entregar");

  return (
    <>
      <Titulo
        accion={
          <div className="flex flex-wrap gap-2">
            {/* La venta en el punto se registra en Ingresos (entra a la caja), pero quien vende la busca aquí. */}
            {vender && (
              <BotonLink href="/ingresos?registrar=venta" variante="secundario">
                Venta en el punto
              </BotonLink>
            )}
            <BotonLink href="/pedidos/recurrentes" variante="secundario">
              Pedidos recurrentes
            </BotonLink>
            {puede(sesion.operacion, "pedidos.crear") && <BotonLink href="/pedidos/nuevo">Nuevo pedido</BotonLink>}
          </div>
        }
      >
        Pedidos
      </Titulo>
      <PestanasPedidos actual="/pedidos" operacion={sesion.operacion} fecha={conFecha ? fecha : undefined} />
      {porAprobarHoy > 0 && (
        // Aviso en azul, como en el inicio: los recurrentes de hoy esperan al administrador.
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-blue-800">
          <p>
            {porAprobarHoy === 1 ? "Hay 1 pedido recurrente de hoy por aprobar." : `Hay ${porAprobarHoy} pedidos recurrentes de hoy por aprobar.`}{" "}
            {estado !== "POR_APROBAR" && (
              <Link href="/pedidos?estado=POR_APROBAR" className="underline">
                Verlos
              </Link>
            )}
            {!puede(sesion.operacion, "pedidos.aprobar") && " Los aprueba el administrador."}
          </p>
          {puede(sesion.operacion, "pedidos.aprobar") && (
            <Formulario accion={aprobarPedidosDeHoy} className="">
              <Boton type="submit">Aprobar todos</Boton>
            </Formulario>
          )}
        </div>
      )}
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          Estado
          <select name="estado" defaultValue={estado} className="mt-1">
            <option value="POR_APROBAR">Por aprobar</option>
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
        <label>
          Cliente o zona
          <input type="search" name="q" defaultValue={q} placeholder="Buscar" className="mt-1" />
        </label>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>
      {pedidos.length === 0 ? (
        <Vacio>No hay pedidos con ese filtro.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              {/* En el celular quedan Cliente (con la fecha debajo), Valor y Estado, para no desplazar de lado. */}
              <th className="hidden sm:table-cell">#</th>
              <th className="hidden sm:table-cell">Entrega</th>
              <th>Cliente</th>
              <th className="hidden sm:table-cell">Productos</th>
              <th className="text-right">Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className="hidden sm:table-cell">
                  <Link href={`/pedidos/${p.id}`} className="underline">
                    {p.id}
                  </Link>
                </td>
                <td className="hidden whitespace-nowrap sm:table-cell">{formatoDia(p.fechaEntrega)}</td>
                <td>
                  {/* El nombre también abre el pedido: el número solo es un blanco muy pequeño. */}
                  <Link href={`/pedidos/${p.id}`} className="underline">
                    {p.cliente.nombre}
                  </Link>
                  <span className="block text-stone-600 sm:hidden">
                    #{p.id} · {formatoDia(p.fechaEntrega)}
                  </span>
                </td>
                <td className="hidden text-stone-600 sm:table-cell">{p.detalles.map((d) => `${d.cantidad} ${d.producto.nombre}`).join(", ")}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatoPesos(totalPedido(p.detalles))}</td>
                <td>
                  <Etiqueta color={ESTADOS[p.estado].color}>
                    {ESTADOS[p.estado].texto}
                    {p.estado === "ENTREGADO" && esParcial(p.detalles) && " parcial"}
                  </Etiqueta>
                </td>
              </tr>
            ))}
          </tbody>
          {conFecha && (
            <tfoot>
              <tr className="font-semibold">
                {/* Una celda por diseño: en el celular solo hay una columna antes del valor. */}
                <td className="sm:hidden">{q ? "Total del día (de esta búsqueda)" : "Total del día"}</td>
                <td colSpan={3} className="hidden sm:table-cell">
                  {q ? "Total del día (de esta búsqueda)" : "Total del día"}
                </td>
                <td className="hidden sm:table-cell">{resumen.join(", ")}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatoPesos(valorTotal)}</td>
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
