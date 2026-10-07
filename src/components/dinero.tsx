import type { ReactNode } from "react";
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

/** Elegir el día de caja que se consulta (hasta hoy). */
export function SelectorDiaCaja({ ruta, diaISO }: { ruta: string; diaISO: string }) {
  return (
    <form action={ruta} className="mb-4 flex flex-wrap items-end gap-2">
      <label>
        Ver otro día
        <input type="date" name="dia" defaultValue={diaISO} max={hoyISO()} className="mt-1" />
      </label>
      <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
        Ver
      </button>
    </form>
  );
}

/** Lista de entradas o salidas de dinero de un día, con su origen y los totales por medio. */
export function ListaDinero({ titulo, filas, vacio }: { titulo: string; filas: FilaDinero[]; vacio: string }) {
  const vigentes = filas.filter((f) => !f.anulado);
  const total = (medio: FilaDinero["medio"]) => vigentes.filter((f) => f.medio === medio).reduce((s, f) => s + f.valor, 0);
  return (
    <Tarjeta titulo={`${titulo} (${vigentes.length})`} className="self-start">
      {filas.length === 0 ? (
        <p className="text-sm text-stone-500">{vacio}</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {filas.map((f) => (
            <li key={f.clave} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="text-stone-400">{formatoHora(f.fecha)}</span> <strong>{f.origen}</strong> · {f.detalle} ·{" "}
                {f.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                <span className="text-stone-400"> · {f.usuario}</span> {f.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
              </span>
              <span className="flex items-center gap-2">
                <span className={f.anulado ? "text-stone-400 line-through" : ""}>{formatoPesos(f.valor)}</span>
                {f.anular}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 space-y-1 border-t border-stone-200 pt-2 text-sm">
        <div className="flex justify-between">
          <span>Efectivo</span>
          <span>{formatoPesos(total("EFECTIVO"))}</span>
        </div>
        <div className="flex justify-between">
          <span>Transferencia</span>
          <span>{formatoPesos(total("TRANSFERENCIA"))}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatoPesos(total("EFECTIVO") + total("TRANSFERENCIA"))}</span>
        </div>
      </div>
    </Tarjeta>
  );
}
