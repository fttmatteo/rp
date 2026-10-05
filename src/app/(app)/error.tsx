"use client";

import { Alerta, Boton } from "@/components/ui";

// Si una pantalla falla (por ejemplo, se cae la conexión con la base de datos),
// se muestra un aviso con opción de reintentar en lugar de una página en blanco.
export default function ErrorPantalla({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alerta>No se pudo cargar esta pantalla. Revisa la conexión e intenta de nuevo.</Alerta>
      <Boton type="button" onClick={reset}>
        Reintentar
      </Boton>
    </div>
  );
}
