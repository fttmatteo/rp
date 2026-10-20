import Link from "next/link";
import { BotonLink, EtiquetaInactivo, Tabla, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { ETIQUETA_OPERACION, esOperacion } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { PestanasUsuarios } from "@/components/secciones";

export default async function UsuariosPage() {
  const sesion = await requerir("usuarios");
  const usuarios = await db.usuario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }] });
  return (
    <>
      <Titulo accion={<BotonLink href="/usuarios/nuevo">Nuevo empleado</BotonLink>}>Empleados</Titulo>
      <PestanasUsuarios actual="/usuarios" operacion={sesion.operacion} />
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
                    <EtiquetaInactivo />
                  </>
                )}
              </td>
              <td>{u.usuario}</td>
              <td>{u.accesos.filter(esOperacion).map((a) => ETIQUETA_OPERACION[a]).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </>
  );
}
