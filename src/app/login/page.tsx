import { redirect } from "next/navigation";
import { PieCreditos } from "@/components/creditos";
import { Formulario } from "@/components/formulario";
import { Boton, Campo } from "@/components/ui";
import { NOMBRE_SOFTWARE, nombreEmpresa } from "@/lib/marca";
import { obtenerSesion } from "@/lib/sesion";
import { iniciarSesion } from "./acciones";

export default async function LoginPage() {
  if (await obtenerSesion()) redirect("/");
  return (
    <>
      <main className="mx-auto mt-16 max-w-sm px-4">
        {/* La puerta de entrada es de la empresa; RP Software firma abajo, en el pie. */}
        <h1 className="text-center text-2xl font-semibold">{nombreEmpresa() || NOMBRE_SOFTWARE}</h1>
        <p className="mb-6 text-center text-stone-600">Inicio de sesión</p>
        <Formulario accion={iniciarSesion}>
          <Campo etiqueta="Usuario">
            {/* Sin autocorrector: el celular no debe cambiar el usuario mientras se escribe. */}
            <input name="usuario" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
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
