import { BotonLink, Tabla, Titulo, Vacio } from "@/components/ui";
import { diaUTC, hoyISO } from "@/lib/formato";
import { formatoCelda, generarReporte, leerParametros, REPORTES } from "@/lib/reportes";
import { requerir } from "@/lib/sesion";

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; desde?: string; hasta?: string }> }) {
  await requerir("reportes");
  const hoy = hoyISO();
  const p = leerParametros(await searchParams, hoy);
  const reporte = await generarReporte(p.tipo, diaUTC(p.desde), diaUTC(p.hasta), diaUTC(hoy));
  const consulta = new URLSearchParams({ tipo: p.tipo, desde: p.desde, hasta: p.hasta }).toString();
  const derecha = (i: number) => (reporte.columnas[i].tipo && reporte.columnas[i].tipo !== "texto" ? "text-right" : "");

  return (
    <>
      <Titulo
        accion={
          <span className="flex gap-2">
            <BotonLink href={`/reportes/exportar?${consulta}&formato=csv`} variante="secundario" prefetch={false}>
              Excel (CSV)
            </BotonLink>
            <BotonLink href={`/reportes/exportar?${consulta}&formato=pdf`} variante="secundario" prefetch={false} target="_blank">
              PDF
            </BotonLink>
          </span>
        }
      >
        Reportes
      </Titulo>
      <form action="/reportes" className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          Reporte
          <select name="tipo" defaultValue={p.tipo} className="mt-1">
            {Object.entries(REPORTES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" name="desde" defaultValue={p.desde} className="mt-1" />
        </label>
        <label>
          Hasta
          <input type="date" name="hasta" defaultValue={p.hasta} className="mt-1" />
        </label>
        <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
          Ver
        </button>
      </form>

      <h2 className="mb-2 font-semibold">{reporte.titulo}</h2>
      {reporte.filas.length === 0 ? (
        <Vacio>Sin datos en este período.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              {reporte.columnas.map((c, i) => (
                <th key={c.titulo} className={derecha(i)}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reporte.filas.map((f, j) => (
              <tr key={j}>
                {f.map((v, i) => (
                  <td key={i} className={derecha(i)}>
                    {formatoCelda(v, reporte.columnas[i].tipo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {reporte.total && (
            <tfoot>
              <tr className="font-semibold">
                {reporte.total.map((v, i) => (
                  <td key={i} className={derecha(i)}>
                    {v === null ? "" : formatoCelda(v, reporte.columnas[i].tipo)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </Tabla>
      )}
      {reporte.nota && <p className="mt-2 text-sm text-stone-500">{reporte.nota}</p>}
    </>
  );
}
