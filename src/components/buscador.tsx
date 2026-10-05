"use client";

import { normalizar } from "@/lib/texto";

/** Filtra en el navegador los elementos con data-buscar dentro del contenedor indicado. */
export function Buscador({ objetivo, placeholder = "Buscar" }: { objetivo: string; placeholder?: string }) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      aria-label={placeholder}
      onInput={(e) => {
        const q = normalizar(e.currentTarget.value.trim());
        document.querySelectorAll<HTMLElement>(`#${objetivo} [data-buscar]`).forEach((el) => {
          el.hidden = q !== "" && !el.dataset.buscar!.includes(q);
        });
      }}
    />
  );
}
