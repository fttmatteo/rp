import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { requerir } from "@/lib/sesion";
import { actualizarUsuario } from "../acciones";
import { CampoNombre, CamposAccesos } from "../campos";

export default async function UsuarioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  await requerir("usuarios");
  const id = Number((await params).id);
  const { creado } = await searchParams;
  const usuario = Number.isInteger(id) ? await db.usuario.findUnique({ where: { id } }) : null;
  if (!usuario) notFound();
  return (
    <>
      <Titulo accion={<BotonLink href="/usuarios" variante="secundario">Volver</BotonLink>}>
        {usuario.nombre} <span className="font-normal text-stone-500">({usuario.usuario})</span>
      </Titulo>
      {creado && (
        <div className="mb-4 max-w-md">
          <Alerta tipo="ok">Empleado creado. Ya puede entrar con su usuario y su clave.</Alerta>
        </div>
      )}
      <Tarjeta className="max-w-md">
        <Formulario accion={actualizarUsuario.bind(null, usuario.id)}>
          <CampoNombre valor={usuario.nombre} />
          <CamposAccesos actuales={usuario.accesos} />
          <label className="flex min-h-11 items-center gap-2 font-normal">
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
