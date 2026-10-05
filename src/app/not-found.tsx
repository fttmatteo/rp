import { BotonLink } from "@/components/ui";

// Enlaces viejos o registros que no existen (por ejemplo /pedidos/9999).
export default function NoEncontrado() {
  return (
    <main className="mx-auto mt-16 max-w-md px-4 text-center">
      <h1 className="mb-2 text-xl font-semibold">No encontrado</h1>
      <p className="mb-6 text-stone-600">Lo que buscas no existe o fue eliminado.</p>
      <BotonLink href="/">Ir al inicio</BotonLink>
    </main>
  );
}
