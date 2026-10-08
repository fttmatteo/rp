import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { ETIQUETA_OPERACION, esOperacion } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { PestanasUsuarios } from "@/components/secciones";
import { crearUsuario } from "./acciones";
import { CampoNombre, CamposAccesos } from "./campos";

export default async function UsuariosPage() {
  const sesion = await requerir("usuarios");
  const usuarios = await db.usuario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }] });
  return (
    <>
      <Titulo>Empleados</Titulo>
      <PestanasUsuarios actual="/usuarios" operacion={sesion.operacion} />
      <div id="lista" className="grid items-start gap-6 md:grid-cols-[2fr_1fr]">
        <Tabla>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Accesos</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/usuarios/${u.id}`} className="underline">
                    {u.nombre}
                  </Link>
                  {!u.activo && (
                    <>
                      {" "}
                      <Etiqueta color="rojo">Inactivo</Etiqueta>
                    </>
                  )}
                </td>
                <td>{u.usuario}</td>
                <td>{u.accesos.filter(esOperacion).map((a) => ETIQUETA_OPERACION[a]).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
        <Tarjeta id="nuevo" titulo="Nuevo usuario" className="self-start">
          <Formulario accion={crearUsuario}>
            <CampoNombre />
            <Campo etiqueta="Usuario" ayuda="Con este nombre ingresa a la app.">
              <input name="usuario" autoCapitalize="none" required />
            </Campo>
            <Campo etiqueta="Clave" ayuda="Mínimo 8 caracteres.">
              <input name="clave" type="password" autoComplete="new-password" required />
            </Campo>
            <CamposAccesos />
            <Boton type="submit">Crear usuario</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
