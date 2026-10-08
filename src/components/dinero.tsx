import Link from "next/link";
import type { ReactNode } from "react";
import { paginar, Paginacion } from "@/components/paginacion";
import { Etiqueta, Tarjeta } from "@/components/ui";
import { formatoHora, formatoPesos, hoyISO } from "@/lib/formato";

export interface FilaDinero {
  clave: string;
  fecha: Date;
  /** De dónde viene: venta, abono, compra, gasto... */
  origen: string;
  detalle: ReactNode;
  medio: "EFECTIVO" | "TRANSFERENCIA";
  usuario: string;
  valor: number;
  anulado: boolean;
  anular?: ReactNode;
}

/** Elegir el día de caja que se consulta (hasta hoy). Va junto al título para no ocupar una fila propia. */
export function SelectorDiaCaja({ ruta, diaISO }: { ruta: string; diaISO: string }) {
  return (
    <form action={ruta} className="flex items-center gap-2">
      <input type="date" name="dia" defaultValue={diaISO} max={hoyISO()} aria-label="Ver otro día" className="w-auto" />
      <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
        Ver
      </button>
    </form>
  );
}

/**
 * Botones para elegir qué se registra. Se muestra un solo formulario a la vez, así la lista del día
 * queda a la vista en lugar de tres formularios largos uno debajo del otro.
 */
export function ElegirRegistro({
  ruta,
  diaISO,
  actual,
  opciones,
}: {
  ruta: string;
  diaISO: string;
  actual: string;
  opciones: { clave: string; texto: string }[];
}) {
  if (opciones.length === 0) return null;
  return (
    <nav aria-label="Qué vas a registrar" className="flex flex-wrap gap-2 text-sm">
      {opciones.map((o) => (
        <Link
          key={o.clave}
          href={`${ruta}?dia=${diaISO}&registrar=${o.clave}`}
          aria-current={o.clave === actual ? "true" : undefined}
          className={`rounded border px-3 py-1.5 ${o.clave === actual ? "border-amber-600 bg-amber-50 font-semibold" : "border-stone-300 bg-white hover:bg-stone-100"}`}
        >
          {o.texto}
        </Link>
      ))}
    </nav>
  );
}

/** La opción elegida en la URL, o la primera si no viene o no está disponible. */
export function registroElegido(valor: string | undefined, opciones: { clave: string }[]): string | undefined {
  return opciones.find((o) => o.clave === valor)?.clave ?? opciones[0]?.clave;
}

/** Lista de entradas o salidas de dinero de un día, con su origen y los totales por medio. */
export function ListaDinero({
  id,
  titulo,
  filas,
  vacio,
  ruta,
  diaISO,
  pagina,
}: {
  id?: string;
  titulo: string;
  filas: FilaDinero[];
  vacio: string;
  ruta: string;
  diaISO: string;
  pagina: number;
}) {
  const vigentes = filas.filter((f) => !f.anulado);
  const total = (medio: FilaDinero["medio"]) => vigentes.filter((f) => f.medio === medio).reduce((s, f) => s + f.valor, 0);
  return (
    <Tarjeta id={id} titulo={`${titulo} (${vigentes.length})`} className="self-start">
      {/* Los totales van arriba: es lo primero que se busca y la lista puede ser larga. */}
      <dl className="mb-3 grid grid-cols-3 gap-2 rounded bg-stone-50 p-2 text-sm">
        <div>
          <dt className="text-stone-600">Efectivo</dt>
          <dd>{formatoPesos(total("EFECTIVO"))}</dd>
        </div>
        <div>
          <dt className="text-stone-600">Transferencia</dt>
          <dd>{formatoPesos(total("TRANSFERENCIA"))}</dd>
        </div>
        <div>
          <dt className="text-stone-600">Total</dt>
          <dd className="font-semibold">{formatoPesos(total("EFECTIVO") + total("TRANSFERENCIA"))}</dd>
        </div>
      </dl>
      {filas.length === 0 ? (
        <p className="text-sm text-stone-500">{vacio}</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {paginar(filas, pagina).map((f) => (
            <li key={f.clave} className="flex justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="text-stone-400">{formatoHora(f.fecha)}</span> <strong>{f.origen}</strong> · {f.detalle} ·{" "}
                {f.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                <span className="text-stone-400"> · {f.usuario}</span> {f.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
              </span>
              <span className="flex shrink-0 items-start gap-2">
                <span className={f.anulado ? "text-stone-400 line-through" : ""}>{formatoPesos(f.valor)}</span>
                {f.anular}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Paginacion ruta={ruta} params={{ dia: diaISO }} pagina={pagina} total={filas.length} ancla={id} />
    </Tarjeta>
  );
}
