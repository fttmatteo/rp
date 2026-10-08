import { AUTOR, EnlaceAutor, NOMBRE_SOFTWARE, VERSION } from "@/components/creditos";
import { Tarjeta, Titulo } from "@/components/ui";
import { requerir } from "@/lib/sesion";

export default async function AcercaPage() {
  await requerir();
  return (
    <>
      <Titulo>Acerca de</Titulo>
      <Tarjeta className="mx-auto max-w-md text-center">
        <img src="/icons/svg/icono.svg" alt="" width={512} height={512} className="mx-auto mb-4 w-28 rounded-2xl" />
        <h2 className="text-lg font-semibold">{NOMBRE_SOFTWARE}</h2>
        <p className="text-sm text-stone-600">Versión {VERSION}</p>
        <p className="mt-3 text-sm">Gestión de producción, inventario, ventas y cartera.</p>
        <p className="mt-4 text-sm">
          Hecho por <EnlaceAutor className="font-medium underline" />
        </p>
        <p className="mt-1 text-xs text-stone-500">{AUTOR.url.replace("https://", "")}</p>
        <p className="mt-4 text-xs text-stone-500">
          © {new Date().getFullYear()} {NOMBRE_SOFTWARE}. Todos los derechos reservados.
        </p>
      </Tarjeta>
    </>
  );
}
