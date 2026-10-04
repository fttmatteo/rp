import { redirect } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Boton, Campo } from "@/components/ui";
import { obtenerSesion } from "@/lib/sesion";
import { iniciarSesion } from "./acciones";

export default async function LoginPage() {
  if (await obtenerSesion()) redirect("/");
  return (
    <main className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="mb-1 text-2xl font-semibold">RP Software</h1>
      <p className="mb-6 text-sm text-stone-600">Ingresa con tu usuario.</p>
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
  );
}
