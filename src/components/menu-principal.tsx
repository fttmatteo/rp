"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type EntradaMenu = {
  href: string;
  texto: string;
  /** Rutas que pertenecen a la sección (con sus subpáginas), para marcarla como actual. */
  rutas: string[];
};

/** "/" solo coincide consigo misma; las demás, consigo y con sus subpáginas ("/caja" con "/caja/reporte"). */
function dentroDe(ruta: string, pagina: string) {
  return ruta === "/" ? pagina === "/" : pagina === ruta || pagina.startsWith(`${ruta}/`);
}

/**
 * Menú principal. Marca la sección en la que se está (el layout del servidor no sabe en qué página está).
 * En el celular las entradas bajan a una segunda línea en vez de esconderse con desplazamiento lateral.
 */
export function MenuPrincipal({ entradas }: { entradas: EntradaMenu[] }) {
  const pagina = usePathname();
  return (
    <nav aria-label="Menú principal" className="mx-auto max-w-5xl px-4">
      <ul className="flex flex-wrap gap-1 pb-2">
        {entradas.map((e) => {
          const actual = e.rutas.some((r) => dentroDe(r, pagina));
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={actual ? "page" : undefined}
                className={`block rounded border px-3 py-2.5 ${actual ? "border-amber-600 bg-amber-50 font-semibold" : "border-transparent hover:bg-stone-100"}`}
              >
                {e.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
