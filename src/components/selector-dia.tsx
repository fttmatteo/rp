import Link from "next/link";
import type { ReactNode } from "react";
import { Boton } from "@/components/ui";
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
      <Boton type="submit" variante="secundario">
        Ver
      </Boton>
      {/* Atajos de 44px de alto para tocarlos con el pulgar. */}
      <span className="flex flex-wrap gap-x-3">
        <Link href={enlace(iso(sumarDias(diaUTC(fecha), -1)))} className="inline-flex min-h-11 items-center px-1 underline">
          Día anterior
        </Link>
        <Link href={enlace(hoy)} className="inline-flex min-h-11 items-center px-1 underline">
          Hoy
        </Link>
        <Link href={enlace(iso(sumarDias(diaUTC(hoy), 1)))} className="inline-flex min-h-11 items-center px-1 underline">
          Mañana
        </Link>
        <Link href={enlace(iso(sumarDias(diaUTC(fecha), 1)))} className="inline-flex min-h-11 items-center px-1 underline">
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
