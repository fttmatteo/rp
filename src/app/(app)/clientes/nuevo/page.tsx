import { Formulario } from "@/components/formulario";
import { Boton, BotonLink, Tarjeta, Titulo } from "@/components/ui";
import { requerir } from "@/lib/sesion";
import { crearCliente } from "../acciones";
import { CamposCliente } from "../campos";

export default async function NuevoClientePage() {
  await requerir("clientes.editar");
  return (
    <>
      <Titulo accion={<BotonLink href="/clientes" variante="secundario">Volver</BotonLink>}>Nuevo cliente</Titulo>
      <Tarjeta className="max-w-2xl">
        <Formulario accion={crearCliente}>
          <CamposCliente />
          <Boton type="submit">Crear cliente</Boton>
        </Formulario>
      </Tarjeta>
    </>
  );
}
