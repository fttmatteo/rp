import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BotonLink, Etiqueta, Tabla, Titulo, Vacio } from "@/components/ui";
import { saldosPorCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; inactivos?: string }> }) {
  const sesion = await requerir("clientes.ver");
  const { q = "", inactivos } = await searchParams;
  const where: Prisma.ClienteWhereInput = {
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
  const clientes = await db.cliente.findMany({
    where,
    orderBy: { nombre: "asc" },
    take: 200,
    include: { _count: { select: { precios: true } } },
  });
  const saldos = await saldosPorCliente(clientes.map((c) => c.id));

  return (
    <>
      <Titulo accion={puede(sesion.operacion, "clientes.editar") && <BotonLink href="/clientes/nuevo">Nuevo cliente</BotonLink>}>
        Clientes
      </Titulo>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono o zona" className="max-w-sm" />
        <label className="flex items-center gap-2 font-normal">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={Boolean(inactivos)} /> Incluir inactivos
        </label>
        <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
          Buscar
        </button>
      </form>
      {clientes.length === 0 ? (
        <Vacio>No hay clientes{q ? " con esa búsqueda" : " todavía"}.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Zona</th>
              <th className="text-right">Debe</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const saldo = saldos.get(c.id) ?? 0;
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clientes/${c.id}`} className="underline">
                      {c.nombre}
                    </Link>{" "}
                    {c._count.precios > 0 && <Etiqueta color="ambar">Precio especial</Etiqueta>}{" "}
                    {!c.activo && <Etiqueta color="rojo">Inactivo</Etiqueta>}
                  </td>
                  <td>{c.telefono}</td>
                  <td>{c.zona}</td>
                  <td className={`text-right ${saldo > 0 ? "font-semibold text-red-700" : "text-stone-500"}`}>
                    {formatoPesos(saldo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}
    </>
  );
}
