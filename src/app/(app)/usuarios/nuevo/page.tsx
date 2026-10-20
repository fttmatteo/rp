import { Formulario } from "@/components/formulario";
import { Boton, BotonLink, Campo, Tarjeta, Titulo } from "@/components/ui";
import { requerir } from "@/lib/sesion";
import { crearUsuario } from "../acciones";
import { CampoNombre, CamposAccesos } from "../campos";

export default async function NuevoEmpleadoPage() {
  await requerir("usuarios");
  return (
    <>
      <Titulo accion={<BotonLink href="/usuarios" variante="secundario">Volver</BotonLink>}>Nuevo empleado</Titulo>
      <Tarjeta className="max-w-md">
        <Formulario accion={crearUsuario}>
          <CampoNombre />
          <Campo etiqueta="Usuario" ayuda="Con este nombre ingresa a la app.">
            <input name="usuario" autoCapitalize="none" required />
          </Campo>
          <Campo etiqueta="Clave" ayuda="Mínimo 8 caracteres.">
            <input name="clave" type="password" autoComplete="new-password" required />
          </Campo>
          <CamposAccesos />
          <Boton type="submit">Crear empleado</Boton>
        </Formulario>
      </Tarjeta>
    </>
  );
}
