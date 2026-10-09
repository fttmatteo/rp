import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { PestanasUsuarios } from "@/components/secciones";
import { Boton, EtiquetaInactivo, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
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
            <Boton type="submit" variante="secundario">
              Buscar
            </Boton>
          </form>
          {proveedores.length === 0 ? (
            <Vacio>{q ? "Ningún proveedor coincide con esa búsqueda." : "Todavía no hay proveedores."}</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  {/* En el celular el teléfono y los días de crédito bajan debajo del nombre, que abre la ficha. */}
                  <th>Proveedor</th>
                  <th className="hidden sm:table-cell">Teléfono</th>
                  <th className="hidden sm:table-cell">Días de crédito</th>
                  <th className="hidden sm:table-cell">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/proveedores/${p.id}`} className="underline">
                        {p.nombre}
                      </Link>{" "}
                      {!p.activo && <EtiquetaInactivo />}
                      <span className="block text-stone-600 sm:hidden">
                        {[p.telefono, `${p.diasCredito} días de crédito`].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell">{p.telefono ?? "—"}</td>
                    <td className="hidden tabular-nums sm:table-cell">{p.diasCredito}</td>
                    <td className="hidden text-right sm:table-cell">
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
