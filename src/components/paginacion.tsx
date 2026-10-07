import Link from "next/link";

export const POR_PAGINA = 50;

/** Número de página de la URL (1 si no viene o no es válido). */
export function leerPagina(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/** skip y take de Prisma para la página pedida. */
export function rango(pagina: number, porPagina = POR_PAGINA) {
  return { skip: (pagina - 1) * porPagina, take: porPagina };
}

/**
 * Enlaces Anterior / Siguiente que conservan los demás filtros de la URL.
 * `param` permite tener dos listas paginadas en la misma página.
 */
export function Paginacion({
  ruta,
  params = {},
  pagina,
  total,
  porPagina = POR_PAGINA,
  param = "pagina",
  ancla,
}: {
  ruta: string;
  params?: Record<string, string | string[] | undefined>;
  pagina: number;
  total: number;
  porPagina?: number;
  param?: string;
  /** Sección a la que vuelve al cambiar de página. */
  ancla?: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const actual = Math.min(pagina, paginas);
  const enlace = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === param || v === undefined || v === "") continue;
      for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
    }
    if (n > 1) q.set(param, String(n));
    const s = q.toString();
    return `${ruta}${s ? `?${s}` : ""}${ancla ? `#${ancla}` : ""}`;
  };
  const desde = (actual - 1) * porPagina + 1;
  const hasta = Math.min(actual * porPagina, total);
  return (
    <nav aria-label="Páginas" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-stone-600">
        {desde}–{hasta} de {total}
      </span>
      <span className="flex items-center gap-2">
        {actual > 1 ? (
          <Link href={enlace(actual - 1)} className="rounded border border-stone-300 bg-white px-3 py-1.5">
            Anterior
          </Link>
        ) : (
          <span className="rounded border border-stone-200 px-3 py-1.5 text-stone-400">Anterior</span>
        )}
        <span>
          Página {actual} de {paginas}
        </span>
        {actual < paginas ? (
          <Link href={enlace(actual + 1)} className="rounded border border-stone-300 bg-white px-3 py-1.5">
            Siguiente
          </Link>
        ) : (
          <span className="rounded border border-stone-200 px-3 py-1.5 text-stone-400">Siguiente</span>
        )}
      </span>
    </nav>
  );
}

/** Para listas que ya están en memoria (las de un solo día): la porción de la página. */
export function paginar<T>(lista: T[], pagina: number, porPagina = POR_PAGINA): T[] {
  return lista.slice((pagina - 1) * porPagina, pagina * porPagina);
}
