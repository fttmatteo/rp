// Componentes básicos de la interfaz. Sin librerías: solo HTML y Tailwind.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variante = "primario" | "secundario" | "peligro";

const VARIANTES: Record<Variante, string> = {
  // Texto en tinta sobre ámbar: el blanco no da contraste (3.2:1).
  primario: "bg-amber-500 text-stone-900 hover:bg-amber-600 active:bg-amber-600 border-amber-600",
  secundario: "bg-white text-stone-900 hover:bg-stone-100 active:bg-stone-100 border-stone-300",
  peligro: "bg-white text-red-700 hover:bg-red-50 active:bg-red-50 border-red-300",
};

// Alto mínimo de 44px para tocarlo con el pulgar en el celular.
const BASE_BOTON =
  "inline-flex min-h-11 items-center justify-center rounded border px-4 py-2 text-center text-base font-medium disabled:cursor-not-allowed disabled:opacity-50";

/** Clases de un botón, para enlaces que no son de la app (tel:, wa.me, Maps). */
export function claseBoton(variante: Variante = "primario") {
  return `${BASE_BOTON} ${VARIANTES[variante]}`;
}

export function Boton({ variante = "primario", className = "", ...props }: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={`${BASE_BOTON} ${VARIANTES[variante]} ${className}`} {...props} />;
}

export function BotonLink({ variante = "primario", className = "", ...props }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={`${BASE_BOTON} ${VARIANTES[variante]} ${className}`} {...props} />;
}

/**
 * Acción en forma de enlace dentro de una fila o un texto (Anular, Ya llegó al banco). Mide 44px de alto
 * para tocarla con el pulgar; `peligro` la pone en rojo de deuda.
 */
export function BotonTexto({ peligro = false, className = "", ...props }: ComponentProps<"button"> & { peligro?: boolean }) {
  return <button className={`inline-flex min-h-11 items-center underline ${peligro ? "text-red-700" : ""} ${className}`} {...props} />;
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label>
        {etiqueta}
        <div className="mt-1">{children}</div>
      </label>
      {ayuda && <p className="text-sm text-stone-500">{ayuda}</p>}
    </div>
  );
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">{children}</h1>
      {accion}
    </div>
  );
}

export function Tarjeta({ titulo, children, className = "", id }: { titulo?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`min-w-0 rounded border border-stone-200 bg-white p-4 ${className}`}>
      {titulo && <h2 className="mb-3 text-lg font-semibold">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Alerta({ tipo = "error", children }: { tipo?: "error" | "ok" | "aviso"; children: ReactNode }) {
  const estilos = {
    error: "border-red-300 bg-red-50 text-red-800",
    ok: "border-green-300 bg-green-50 text-green-800",
    aviso: "border-blue-300 bg-blue-50 text-blue-800",
  }[tipo];
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded border px-3 py-2 ${estilos}`}>
      {children}
    </p>
  );
}

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-stone-200 bg-white">
      <table className="w-full text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-stone-600 [&_thead]:bg-stone-100 [&_tr]:border-b [&_tr]:border-stone-100">
        {children}
      </table>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded border border-dashed border-stone-300 p-6 text-center text-stone-500">{children}</p>;
}

export function Etiqueta({ children, color = "gris" }: { children: ReactNode; color?: "gris" | "verde" | "rojo" | "azul" }) {
  const estilos = {
    gris: "bg-stone-100 text-stone-700",
    verde: "bg-green-100 text-green-800",
    rojo: "bg-red-100 text-red-800",
    azul: "bg-blue-100 text-blue-800",
  }[color];
  return <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${estilos}`}>{children}</span>;
}

/**
 * Cliente, proveedor o empleado que ya no está activo. Gris en todas partes: es un estado, no una deuda ni un
 * error (el rojo queda para lo vencido, lo anulado y los errores).
 */
export function EtiquetaInactivo() {
  return <Etiqueta>Inactivo</Etiqueta>;
}

export type Vista = { clave: string; texto: string };

/**
 * Pestañas dentro de una misma página larga (liquidación de ruta, galpón, Mi ruta): muestran una parte
 * a la vez en vez de apilarlo todo y obligar a bajar. La parte elegida va en ?ver=, junto con los filtros
 * de la página. Se ven igual que las pestañas de sección.
 */
export function Vistas({
  ruta,
  actual,
  vistas,
  params = {},
}: {
  ruta: string;
  actual: string;
  vistas: (Vista | false | null | undefined)[];
  params?: Record<string, string | undefined>;
}) {
  const enlace = (clave: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("ver", clave);
    return `${ruta}?${q}`;
  };
  return (
    <Pestanas
      actual={actual}
      comparar="clave"
      pestanas={vistas.filter((v): v is Vista => !!v).map((v) => ({ href: enlace(v.clave), texto: v.texto, clave: v.clave }))}
    />
  );
}

/** La vista pedida en ?ver= si existe; si no, la primera. */
export function vistaElegida(valor: string | undefined, vistas: (Vista | false | null | undefined)[]): string | undefined {
  const lista = vistas.filter((v): v is Vista => !!v);
  return (lista.find((v) => v.clave === valor) ?? lista[0])?.clave;
}

/** Pestañas que agrupan páginas de una misma sección (por ejemplo, todo lo de inventario). */
export function Pestanas({
  actual,
  pestanas,
  comparar = "ruta",
}: {
  actual: string;
  pestanas: { href: string; texto: string; clave?: string }[];
  /** "ruta": la pestaña es otra página. "clave": la pestaña es una vista de la misma página (Vistas). */
  comparar?: "ruta" | "clave";
}) {
  if (pestanas.length < 2) return null;
  return (
    <nav aria-label="Pestañas" className="mb-4 overflow-x-auto border-b border-stone-200">
      <ul className="flex gap-1 whitespace-nowrap">
        {pestanas.map((p) => {
          // Se compara solo la ruta: los enlaces pueden llevar filtros (?fecha=...).
          const activa = comparar === "clave" ? p.clave === actual : p.href.split("?")[0] === actual;
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px block border-b-2 px-3 py-2.5 ${activa ? "border-amber-600 font-semibold" : "border-transparent text-stone-600 hover:text-stone-900"}`}
              >
                {p.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
