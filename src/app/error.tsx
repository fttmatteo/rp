"use client";

import { Alerta, Boton } from "@/components/ui";

// Pantallas fuera del menú (ingreso, elegir operación): si fallan, aviso en español en lugar de la página de error de Next.
export default function ErrorGeneral({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto mt-16 max-w-sm space-y-4 px-4">
      <Alerta>No se pudo cargar esta pantalla. Revisa la conexión e intenta de nuevo.</Alerta>
      <Boton type="button" onClick={reset}>
        Reintentar
      </Boton>
    </main>
  );
}
