import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Boton, BotonLink, EtiquetaInactivo, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { requerir } from "@/lib/sesion";
import { actualizarProveedor } from "../acciones";
import { CamposProveedor } from "../campos";

/** Datos del proveedor. Lo que le debemos y los abonos están en Contabilidad > Por pagar. */
export default async function ProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  await requerir("compras");
  const id = Number((await params).id);
  const proveedor = Number.isInteger(id) ? await db.proveedor.findUnique({ where: { id } }) : null;
  if (!proveedor) notFound();

  return (
    <>
      <Titulo
        accion={
          <div className="flex flex-wrap gap-2">
            <BotonLink href={`/por-pagar/${id}`} variante="secundario">
              Ver lo que le debemos
            </BotonLink>
            <BotonLink href="/proveedores" variante="secundario">
              Volver
            </BotonLink>
          </div>
        }
      >
        {proveedor.nombre} {!proveedor.activo && <EtiquetaInactivo />}
      </Titulo>
      <div className="max-w-2xl">
        <Tarjeta id="datos" titulo="Datos del proveedor">
          <Formulario accion={actualizarProveedor.bind(null, id)}>
            <CamposProveedor p={proveedor} />
            <label className="flex min-h-11 items-center gap-2 font-normal">
              <input type="checkbox" name="activo" defaultChecked={proveedor.activo} /> Proveedor activo
            </label>
            <Boton type="submit">Guardar</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
