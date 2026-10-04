import { BotonLink } from "@/components/ui";

export default function SinAccesoPage() {
  return (
    <main className="mx-auto mt-16 max-w-md px-4 text-center">
      <h1 className="mb-2 text-xl font-semibold">Acceso denegado</h1>
      <p className="mb-6 text-stone-600">Tu operación actual no tiene permiso para entrar a esta sección.</p>
      <div className="flex justify-center gap-2">
        <BotonLink href="/">Ir al inicio</BotonLink>
        <BotonLink href="/operacion" variante="secundario">
          Cambiar operación
        </BotonLink>
      </div>
    </main>
  );
}
