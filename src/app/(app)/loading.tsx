// Esqueleto mientras carga cualquier pantalla: bloques grises fijos, sin animación.
// El encabezado y el menú se mantienen; solo se reemplaza el contenido.
function Bloque({ className }: { className: string }) {
  return <div className={`rounded bg-stone-200 ${className}`} />;
}

export default function Cargando() {
  return (
    <div role="status" aria-label="Cargando">
      <Bloque className="mb-4 h-7 w-40" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Bloque className="h-24" />
        <Bloque className="h-24" />
        <Bloque className="hidden h-24 lg:block" />
      </div>
      <div className="space-y-2 rounded border border-stone-200 bg-white p-3">
        <Bloque className="h-5 w-full" />
        <Bloque className="h-5 w-11/12" />
        <Bloque className="h-5 w-full" />
        <Bloque className="h-5 w-10/12" />
        <Bloque className="h-5 w-full" />
      </div>
    </div>
  );
}
