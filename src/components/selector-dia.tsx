import Link from "next/link";
import type { ReactNode } from "react";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Elegir un día (incluidos los futuros) con atajos a ayer, hoy, mañana y el día siguiente. */
export function SelectorDia({
  ruta,
  fecha,
  etiqueta = "Fecha",
  children,
}: {
  ruta: string;
  fecha: string;
  etiqueta?: string;
  children?: ReactNode;
}) {
  const hoy = hoyISO();
  const enlace = (f: string) => `${ruta}?fecha=${f}`;
  return (
    <form action={ruta} className="mb-4 flex flex-wrap items-end gap-2">
      <label>
        {etiqueta}
        <input type="date" name="fecha" defaultValue={fecha} className="mt-1" />
      </label>
      {children}
      <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
        Ver
      </button>
      <span className="flex gap-3 py-2 text-sm">
        <Link href={enlace(iso(sumarDias(diaUTC(fecha), -1)))} className="underline">
          Día anterior
        </Link>
        <Link href={enlace(hoy)} className="underline">
          Hoy
        </Link>
        <Link href={enlace(iso(sumarDias(diaUTC(hoy), 1)))} className="underline">
          Mañana
        </Link>
        <Link href={enlace(iso(sumarDias(diaUTC(fecha), 1)))} className="underline">
          Día siguiente
        </Link>
      </span>
    </form>
  );
}

/** Fecha "AAAA-MM-DD" de la URL, o hoy si no viene o no es válida. */
export function leerFecha(f: string | undefined): string {
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoyISO();
}
