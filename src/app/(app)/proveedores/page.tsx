import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { PestanasUsuarios } from "@/components/secciones";
import { Boton, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { requerir } from "@/lib/sesion";
import { crearProveedor } from "./acciones";
import { CamposProveedor } from "./campos";

/** Crear, ver y editar proveedores. Lo que se les debe está en Contabilidad > Por pagar. */
export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const sesion = await requerir("compras");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const pagina = leerPagina(params.pagina);
  const where: Prisma.ProveedorWhereInput = q
    ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { telefono: { contains: q } }] }
    : {};
  const [proveedores, total] = await Promise.all([
    db.proveedor.findMany({ where, orderBy: [{ activo: "desc" }, { nombre: "asc" }, { id: "asc" }], ...rango(pagina) }),
    db.proveedor.count({ where }),
  ]);

  return (
    <>
      <Titulo>Proveedores</Titulo>
      <PestanasUsuarios actual="/proveedores" operacion={sesion.operacion} />
      <div className="grid items-start gap-6 md:grid-cols-[3fr_2fr]">
        <div>
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="q" type="search" defaultValue={q} placeholder="Buscar por nombre o teléfono" className="max-w-sm" />
            <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
              Buscar
            </button>
          </form>
          {proveedores.length === 0 ? (
            <Vacio>{q ? "Ningún proveedor coincide con esa búsqueda." : "Todavía no hay proveedores."}</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Teléfono</th>
                  <th>Días de crédito</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.nombre} {!p.activo && <Etiqueta>Inactivo</Etiqueta>}
                    </td>
                    <td>{p.telefono ?? "—"}</td>
                    <td>{p.diasCredito}</td>
                    <td className="text-right">
                      <Link href={`/proveedores/${p.id}`} className="underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          <Paginacion ruta="/proveedores" params={{ q }} pagina={pagina} total={total} />
        </div>
        <Tarjeta id="nuevo" titulo="Nuevo proveedor" className="self-start">
          <Formulario accion={crearProveedor}>
            <CamposProveedor />
            <Boton type="submit">Crear proveedor</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
