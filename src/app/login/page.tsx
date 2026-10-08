import { redirect } from "next/navigation";
import { PieCreditos } from "@/components/creditos";
import { Formulario } from "@/components/formulario";
import { Boton, Campo } from "@/components/ui";
import { obtenerSesion } from "@/lib/sesion";
import { iniciarSesion } from "./acciones";

export default async function LoginPage() {
  if (await obtenerSesion()) redirect("/");
  return (
    <>
      <main className="mx-auto mt-16 max-w-sm px-4">
        <img src="/icons/svg/logo-horizontal.svg" alt="" width={1200} height={400} className="mb-4 w-full rounded-lg" />
        <h1 className="mb-1 text-2xl font-semibold text-center">Inicio de sesión</h1>
        <Formulario accion={iniciarSesion}>
          <Campo etiqueta="Usuario">
            <input name="usuario" autoComplete="username" autoCapitalize="none" required />
          </Campo>
          <Campo etiqueta="Clave">
            <input name="clave" type="password" autoComplete="current-password" required />
          </Campo>
          <Boton type="submit" className="w-full">
            Ingresar
          </Boton>
        </Formulario>
      </main>
      <div className="mt-10">
        <PieCreditos conAcerca={false} />
      </div>
    </>
  );
}
