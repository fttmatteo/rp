import Link from "next/link";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Alerta, Boton, BotonLink, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { diaUTC, formatoDia, hoyISO } from "@/lib/formato";
import { diasSinCerrar, primerMesLibro } from "@/lib/libro-db";
import { formatoCelda, generarReporte, leerParametros, REPORTES } from "@/lib/reportes";
import { requerir } from "@/lib/sesion";
import { PestanasContabilidad } from "@/components/secciones";
import { leerPeriodo, mesesEntre, nombreMes } from "@/modules/libro";

type Parametros = { tipo?: string; desde?: string; hasta?: string; libroMes?: string; libroDesde?: string; libroHasta?: string; pagina?: string };

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const sesion = await requerir("reportes");
  const hoy = hoyISO();
  const sp = await searchParams;
  const p = leerParametros(sp, hoy);
  const pagina = leerPagina(sp.pagina);
  // Vuelve aquí desde la descarga del libro cuando el periodo tiene cajas sin cerrar.
  const pedido = sp.libroMes || sp.libroDesde ? leerPeriodo({ mes: sp.libroMes, desde: sp.libroDesde, hasta: sp.libroHasta }, hoy) : null;
  const [reporte, primerMes, sinCerrar] = await Promise.all([
    generarReporte(p.tipo, diaUTC(p.desde), diaUTC(p.hasta), diaUTC(hoy)),
    primerMesLibro(),
    pedido ? diasSinCerrar(pedido.desde, pedido.hasta) : Promise.resolve([]),
  ]);
  const mesActual = hoy.slice(0, 7);
  const meses = mesesEntre(primerMes ?? mesActual, mesActual);
  const consulta = new URLSearchParams({ tipo: p.tipo, desde: p.desde, hasta: p.hasta }).toString();
  const derecha = (i: number) => (reporte.columnas[i].tipo && reporte.columnas[i].tipo !== "texto" ? "text-right" : "");

  return (
    <>
      <Titulo>Reportes</Titulo>
      <PestanasContabilidad actual="/reportes" operacion={sesion.operacion} />
      <Tarjeta id="libro" titulo="Libro mensual en Excel" className="mb-6">
        <p className="mb-3 text-stone-500">
          Cada cobro, ingreso y egreso con su saldo. Solo sale si todas las cajas de esas fechas están cerradas; lo que incluya hoy sale hasta hoy.
        </p>
        {sinCerrar.length > 0 && (
          <div className="mb-3">
            <Alerta>
              {`No se generó el libro ${pedido?.mes ? `de ${nombreMes(pedido.mes)}` : "de ese periodo"} porque ${
                sinCerrar.length === 1 ? "esta caja no está cerrada" : "estas cajas no están cerradas"
              }. Ciérra${sinCerrar.length === 1 ? "la" : "las"} en Caja y vuelve a descargarlo: `}
              {sinCerrar.map((d, i) => (
                <span key={d}>
                  {i > 0 && ", "}
                  <Link href={`/caja?dia=${d}`} className="underline">
                    {formatoDia(diaUTC(d))}
                  </Link>
                </span>
              ))}
              .
            </Alerta>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <form action="/reportes/libro" className="flex flex-wrap items-end gap-2">
          <label>
            Mes
            <select name="mes" defaultValue={pedido?.mes ?? meses[0]} className="mt-1">
              {meses.map((m) => (
                <option key={m} value={m}>
                  {nombreMes(m)}
                  {m === mesActual ? " (en curso)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Boton type="submit" variante="secundario">
            Descargar Excel del mes
          </Boton>
        </form>
        <form action="/reportes/libro" className="flex flex-wrap items-end gap-2">
          <label>
            Desde
            <input type="date" name="desde" defaultValue={pedido && !pedido.mes ? pedido.desde : p.desde} max={hoy} required className="mt-1" />
          </label>
          <label>
            Hasta
            <input type="date" name="hasta" defaultValue={pedido && !pedido.mes ? pedido.hasta : p.hasta} max={hoy} required className="mt-1" />
          </label>
          <Boton type="submit" variante="secundario">
            Descargar Excel del periodo
          </Boton>
        </form>
        </div>
      </Tarjeta>
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
        <Boton type="submit" variante="secundario">
          Ver
        </Boton>
      </form>

      <div id="reporte" className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{reporte.titulo}</h2>
        {/* Descargan solo este reporte con los filtros elegidos; el libro mensual tiene sus propios botones arriba. */}
        <span className="flex flex-wrap gap-2">
          <BotonLink href={`/reportes/exportar?${consulta}&formato=xlsx`} variante="secundario" prefetch={false}>
            Descargar este reporte en Excel
          </BotonLink>
          <BotonLink href={`/reportes/exportar?${consulta}&formato=pdf`} variante="secundario" prefetch={false} target="_blank">
            Descargar este reporte en PDF
          </BotonLink>
        </span>
      </div>
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
            {paginar(reporte.filas, pagina).map((f, j) => (
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
      <Paginacion ruta="/reportes" params={{ tipo: p.tipo, desde: p.desde, hasta: p.hasta }} pagina={pagina} total={reporte.filas.length} ancla="reporte" />
      {reporte.nota && <p className="mt-2 text-stone-500">{reporte.nota}</p>}

    </>
  );
}
