// Componentes básicos de la interfaz. Sin librerías: solo HTML y Tailwind.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variante = "primario" | "secundario" | "peligro";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-amber-600 text-white hover:bg-amber-700 border-amber-700",
  secundario: "bg-white text-stone-800 hover:bg-stone-100 border-stone-300",
  peligro: "bg-white text-red-700 hover:bg-red-50 border-red-300",
};

const BASE_BOTON =
  "inline-flex items-center justify-center rounded border px-4 py-2 text-base font-medium disabled:opacity-50";

export function Boton({ variante = "primario", className = "", ...props }: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={`${BASE_BOTON} ${VARIANTES[variante]} ${className}`} {...props} />;
}

export function BotonLink({ variante = "primario", className = "", ...props }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={`${BASE_BOTON} ${VARIANTES[variante]} ${className}`} {...props} />;
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label>
        {etiqueta}
        <div className="mt-1">{children}</div>
      </label>
      {ayuda && <p className="text-xs text-stone-500">{ayuda}</p>}
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

export function Tarjeta({ titulo, children, className = "" }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded border border-stone-200 bg-white p-4 ${className}`}>
      {titulo && <h2 className="mb-3 font-semibold">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Alerta({ tipo = "error", children }: { tipo?: "error" | "ok" | "aviso"; children: ReactNode }) {
  const estilos = {
    error: "border-red-300 bg-red-50 text-red-800",
    ok: "border-green-300 bg-green-50 text-green-800",
    aviso: "border-amber-300 bg-amber-50 text-amber-900",
  }[tipo];
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded border px-3 py-2 text-sm ${estilos}`}>
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
  return <p className="rounded border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</p>;
}

export function Etiqueta({ children, color = "gris" }: { children: ReactNode; color?: "gris" | "verde" | "rojo" | "ambar" }) {
  const estilos = {
    gris: "bg-stone-100 text-stone-700",
    verde: "bg-green-100 text-green-800",
    rojo: "bg-red-100 text-red-800",
    ambar: "bg-amber-100 text-amber-900",
  }[color];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${estilos}`}>{children}</span>;
}
