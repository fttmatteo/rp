import type { ReactNode } from "react";
import { paginar, Paginacion } from "@/components/paginacion";
import { Boton, Etiqueta, Tabla, Tarjeta } from "@/components/ui";
import { FranjaTotales, type FilaDinero } from "@/components/dinero";
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
    <form action={ruta} className="mb-3 flex flex-wrap items-end gap-2">
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
      <Boton type="submit" variante="secundario">
        Ver
      </Boton>
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
  const vigentes = filas.filter((f) => !f.anulado).length;
  return (
    <Tarjeta id="historial" titulo={`${titulo} (${vigentes})`}>
      <FranjaTotales filas={filas} />
      {nota && <p className="mb-3 text-sm text-stone-500">{nota}</p>}
      {filas.length === 0 ? (
        <p className="text-stone-500">{vacio}</p>
      ) : (
        <Tabla>
          <thead>
            <tr>
              {/* En el celular la fecha y el medio bajan debajo del detalle, para no desplazar de lado. */}
              <th className="hidden sm:table-cell">Fecha</th>
              <th>Tipo</th>
              <th>Detalle</th>
              <th className="hidden sm:table-cell">Medio</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {paginar(filas, pagina).map((f) => (
              <tr key={f.clave}>
                <td className="hidden whitespace-nowrap text-stone-600 sm:table-cell">{formatoFechaHora(f.fecha)}</td>
                <td className="whitespace-nowrap font-medium">{f.origen}</td>
                <td>
                  {f.detalle}
                  <span className="text-stone-500"> · {f.usuario}</span> {f.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                  <span className="block text-stone-600 sm:hidden">
                    {formatoFechaHora(f.fecha)} · {f.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                  </span>
                </td>
                <td className="hidden sm:table-cell">{f.medio === "EFECTIVO" ? "Efectivo" : "Transferencia"}</td>
                <td className={`whitespace-nowrap text-right tabular-nums ${f.anulado ? "text-stone-500 line-through" : ""}`}>{formatoPesos(f.valor)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <Paginacion ruta={ruta} params={params} pagina={pagina} total={filas.length} />
    </Tarjeta>
  );
}
