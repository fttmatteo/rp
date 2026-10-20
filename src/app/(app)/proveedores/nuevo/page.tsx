import { Formulario } from "@/components/formulario";
import { Boton, BotonLink, Tarjeta, Titulo } from "@/components/ui";
import { requerir } from "@/lib/sesion";
import { crearProveedor } from "../acciones";
import { CamposProveedor } from "../campos";

export default async function NuevoProveedorPage() {
  await requerir("compras");
  return (
    <>
      <Titulo accion={<BotonLink href="/proveedores" variante="secundario">Volver</BotonLink>}>Nuevo proveedor</Titulo>
      <Tarjeta className="max-w-2xl">
        <Formulario accion={crearProveedor}>
          <CamposProveedor />
          <Boton type="submit">Crear proveedor</Boton>
        </Formulario>
      </Tarjeta>
    </>
  );
}
