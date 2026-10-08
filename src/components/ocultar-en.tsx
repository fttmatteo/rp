"use client";

import { usePathname } from "next/navigation";

/** Muestra su contenido salvo en la ruta indicada (el layout del servidor no sabe en qué página está). */
export function OcultarEn({ ruta, children }: { ruta: string; children: React.ReactNode }) {
  return usePathname() === ruta ? null : children;
}
