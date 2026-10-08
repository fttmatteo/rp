import type { ReactNode } from "react";
import { paginar, Paginacion } from "@/components/paginacion";
import { Etiqueta, Tabla, Tarjeta } from "@/components/ui";
import type { FilaDinero } from "@/components/dinero";
import { diaUTC, formatoFechaHora, formatoPesos, hoyISO } from "@/lib/formato";
import { leerMes, mesesEntre, nombreMes, rangoMes } from "@/modules/libro";

export type Opcion = { valor: string; texto: string };

/** Mes pedido en la URL ("AAAA-MM") o el del día que se está viendo. */
export function mesElegido(valor: string | undefined, diaISO: string): string {
  return leerMes(valor) ?? diaISO.slice(0, 7);
}

/** Días de caja del mes, para filtrar por `dia`. */
export function diasDelMes(mes: string) {
  const { desde, hasta } = rangoMes(mes);
  return { gte: diaUTC(desde), lte: diaUTC(hasta) };
}

/** Los últimos 24 meses, para elegir. */
function ultimosMeses(): string[] {
  const actual = hoyISO().slice(0, 7);
  const [a, m] = actual.split("-").map(Number);
  const primero = `${a - 2}-${String(m).padStart(2, "0")}`;
  return mesesEntre(primero, actual).slice(0, 24);
}

/**
 * Filtros del historial: mes, tipo y, si hace falta, otro filtro (por ejemplo, el concepto del gasto).
 * Es un formulario GET, así el filtro queda en la URL y se puede compartir o volver atrás.
 */
export function FiltrosHistorial({
  ruta,
  diaISO,
  mes,
  tipo,
  tipos,
  extra,
}: {
  ruta: string;
  diaISO: string;
  mes: string;
  tipo: string;
  tipos: Opcion[];
  extra?: { nombre: string; etiqueta: string; valor: string; opciones: Opcion[] };
}) {
  return (
    <form action={ruta} className="mb-3 flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="dia" value={diaISO} />
      <input type="hidden" name="registrar" value="historial" />
      <label className="flex flex-col gap-1">
        <span className="text-stone-600">Mes</span>
        <select name="mes" defaultValue={mes} className="w-auto">
          {ultimosMeses().map((m) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-stone-600">Tipo</span>
        <select name="tipo" defaultValue={tipo} className="w-auto">
          {tipos.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.texto}
            </option>
          ))}
        </select>
      </label>
      {extra && (
        <label className="flex flex-col gap-1">
          <span className="text-stone-600">{extra.etiqueta}</span>
          <select name={extra.nombre} defaultValue={extra.valor} className="w-auto">
            {extra.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
        Ver
      </button>
    </form>
  );
}

/** Movimientos de dinero de un mes, con fecha, totales por medio arriba y paginación. */
export function HistorialDinero({
  titulo,
  filas,
  vacio,
  ruta,
  params,
  pagina,
  nota,
}: {
  titulo: string;
  filas: FilaDinero[];
  vacio: string;
  ruta: string;
  params: Record<string, string | undefined>;
  pagina: number;
  nota?: ReactNode;
}) {
  const vigentes = filas.filter((f) => !f.anulado);
  const total = (medio: FilaDinero["medio"]) => vigentes.filter((f) => f.medio === medio).reduce((s, f) => s + f.valor, 0);
  return (
    <Tarjeta id="historial" titulo={`${titulo} (${vigentes.length})`}>
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
      {nota && <p className="mb-3 text-xs text-stone-500">{nota}</p>}
      {filas.length === 0 ? (
        <p className="text-sm text-stone-500">{vacio}</p>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Detalle</th>
              <th>Medio</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {paginar(filas, pagina).map((f) => (
              <tr key={f.clave}>
                <td className="whitespace-nowrap text-stone-600">{formatoFechaHora(f.fecha)}</td>
                <td className="whitespace-nowrap font-medium">{f.origen}</td>
                <td>
                  {f.detalle}
                  <span className="text-stone-400"> · {f.usuario}</span> {f.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                </td>
                <td>{f.medio === "EFECTIVO" ? "Efectivo" : "Transferencia"}</td>
                <td className={`text-right ${f.anulado ? "text-stone-400 line-through" : ""}`}>{formatoPesos(f.valor)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <Paginacion ruta={ruta} params={params} pagina={pagina} total={filas.length} />
    </Tarjeta>
  );
}
