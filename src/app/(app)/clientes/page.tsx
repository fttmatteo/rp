import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { Boton, BotonLink, Etiqueta, EtiquetaInactivo, Tabla, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { PestanasUsuarios } from "@/components/secciones";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; inactivos?: string; pagina?: string }> }) {
  const sesion = await requerir("clientes.ver");
  const params = await searchParams;
  const { q = "", inactivos } = params;
  const pagina = leerPagina(params.pagina);
  // El consumidor final de la venta en el punto no es un cliente registrado.
  const where: Prisma.ClienteWhereInput = {
    consumidorFinal: false,
    ...(inactivos ? {} : { activo: true }),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { telefono: { contains: q } },
            { zona: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [clientes, total] = await Promise.all([
    db.cliente.findMany({
      where,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
      ...rango(pagina),
      include: { _count: { select: { precios: true } } },
    }),
    db.cliente.count({ where }),
  ]);

  const editar = puede(sesion.operacion, "clientes.editar");

  return (
    <>
      <Titulo accion={editar && <BotonLink href="/clientes/nuevo">Nuevo cliente</BotonLink>}>
        Clientes
      </Titulo>
      <PestanasUsuarios actual="/clientes" operacion={sesion.operacion} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" type="search" defaultValue={q} placeholder="Buscar por nombre, teléfono o zona" aria-label="Buscar cliente" className="max-w-sm" />
        <label className="flex min-h-11 items-center gap-2 font-normal">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={Boolean(inactivos)} /> Incluir inactivos
        </label>
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>
      {clientes.length === 0 ? (
        <Vacio>No hay clientes{q ? " con esa búsqueda" : " todavía"}.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              {/* En el celular el teléfono y la zona bajan debajo del nombre, que abre la ficha. */}
              <th>Cliente</th>
              <th className="hidden sm:table-cell">Teléfono</th>
              <th className="hidden sm:table-cell">Zona</th>
              <th className="hidden sm:table-cell">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clientes/${c.id}`} className="underline">
                    {c.nombre}
                  </Link>{" "}
                  {c._count.precios > 0 && <Etiqueta color="azul">Precio especial</Etiqueta>}{" "}
                  {!c.activo && <EtiquetaInactivo />}
                  {(c.telefono || c.zona) && (
                    <span className="block text-stone-600 sm:hidden">{[c.telefono, c.zona].filter(Boolean).join(" · ")}</span>
                  )}
                </td>
                <td className="hidden sm:table-cell">{c.telefono}</td>
                <td className="hidden sm:table-cell">{c.zona}</td>
                <td className="hidden text-right sm:table-cell">
                  <Link href={`/clientes/${c.id}`} className="underline">
                    {editar ? "Editar" : "Ver"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <Paginacion ruta="/clientes" params={params} pagina={pagina} total={total} />
    </>
  );
}
