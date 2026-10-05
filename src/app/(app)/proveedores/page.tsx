import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoPesos } from "@/lib/formato";
import { saldosProveedores } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";
import { crearProveedor } from "./acciones";
import { CamposProveedor } from "./campos";

export default async function ProveedoresPage() {
  await requerir("compras");
  const [proveedores, saldos] = await Promise.all([
    db.proveedor.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }] }),
    saldosProveedores(),
  ]);
  const total = [...saldos.values()].reduce((s, v) => s + v, 0);

  return (
    <>
      <Titulo>Proveedores</Titulo>
      <p className="mb-4">
        Cuentas por pagar: <strong className={total > 0 ? "text-red-700" : ""}>{formatoPesos(total)}</strong>
      </p>
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        {proveedores.length === 0 ? (
          <Vacio>Todavía no hay proveedores.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Teléfono</th>
                <th className="text-right">Le debemos</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/proveedores/${p.id}`} className="underline">
                      {p.nombre}
                    </Link>{" "}
                    {!p.activo && <Etiqueta>Inactivo</Etiqueta>}
                  </td>
                  <td>{p.telefono ?? "—"}</td>
                  <td className="text-right">{formatoPesos(saldos.get(p.id) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
        <Tarjeta titulo="Nuevo proveedor">
          <Formulario accion={crearProveedor}>
            <CamposProveedor />
            <Boton type="submit">Crear proveedor</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
