import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Boton, BotonLink, Campo, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { requerir } from "@/lib/sesion";
import { actualizarUsuario } from "../acciones";
import { CampoNombre, CamposAccesos } from "../campos";

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requerir("usuarios");
  const id = Number((await params).id);
  const usuario = Number.isInteger(id) ? await db.usuario.findUnique({ where: { id } }) : null;
  if (!usuario) notFound();
  return (
    <>
      <Titulo accion={<BotonLink href="/usuarios" variante="secundario">Volver</BotonLink>}>
        {usuario.nombre} <span className="font-normal text-stone-500">({usuario.usuario})</span>
      </Titulo>
      <Tarjeta className="max-w-md">
        <Formulario accion={actualizarUsuario.bind(null, usuario.id)}>
          <CampoNombre valor={usuario.nombre} />
          <CamposAccesos actuales={usuario.accesos} />
          <label className="flex items-center gap-2 font-normal">
            <input type="checkbox" name="activo" defaultChecked={usuario.activo} />
            Usuario activo
          </label>
          <Campo etiqueta="Nueva clave" ayuda="Déjala vacía para no cambiarla.">
            <input name="clave" type="password" autoComplete="new-password" />
          </Campo>
          <Boton type="submit">Guardar</Boton>
        </Formulario>
      </Tarjeta>
    </>
  );
}
