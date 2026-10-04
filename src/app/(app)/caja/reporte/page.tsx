import Link from "next/link";
import { BotonLink, Etiqueta, Tabla, Titulo } from "@/components/ui";
import { totalesCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoPesos, hoyISO, sumarDias } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { efectivoEsperado, quincena, totalTransferencias, type TotalesCaja } from "@/modules/caja";
import type { Caja } from "@prisma/client";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 62;

export default async function ReporteCajaPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  await requerir("caja");
  const hoy = hoyISO();
  const actual = quincena(hoy);
  const params = await searchParams;
  const desdeISO = params.desde && FECHA.test(params.desde) ? params.desde : actual.desde;
  let hastaISO = params.hasta && FECHA.test(params.hasta) ? params.hasta : actual.hasta;
  if (hastaISO > hoy) hastaISO = hoy;

  const desde = diaUTC(desdeISO);
  const hasta = diaUTC(hastaISO);
  const cajas = await db.caja.findMany({ where: { dia: { gte: desde, lte: hasta } } });
  const porDia = new Map(cajas.map((c) => [c.dia.getTime(), c]));

  const filas: { dia: Date; caja: Caja | undefined; t: TotalesCaja }[] = [];
  for (let d = desde, n = 0; d <= hasta && n < MAX_DIAS; d = sumarDias(d, 1), n++) {
    const caja = porDia.get(d.getTime());
    const t = await totalesCaja(d, caja?.base ?? 0);
    const movimiento =
      t.cobrosEfectivo + t.cobrosTransferencia + t.ingresosEfectivo + t.ingresosTransferencia + t.egresosEfectivo + t.egresosTransferencia;
    if (!caja && movimiento === 0) continue;
    filas.push({ dia: d, caja, t });
  }

  const suma = (f: (x: (typeof filas)[number]) => number) => filas.reduce((s, x) => s + f(x), 0);
  const totales = {
    cobrosEfectivo: suma((x) => x.t.cobrosEfectivo),
    transferencias: suma((x) => totalTransferencias(x.t)),
    ingresos: suma((x) => x.t.ingresosEfectivo),
    egresos: suma((x) => x.t.egresosEfectivo),
    diferencia: suma((x) => x.caja?.diferencia ?? 0),
  };
  const abiertas = filas.filter((x) => x.caja?.estado !== "CERRADA").length;

  return (
    <>
      <Titulo accion={<BotonLink href="/caja" variante="secundario">Caja de hoy</BotonLink>}>Reporte de caja</Titulo>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          Desde
          <input type="date" name="desde" defaultValue={desdeISO} max={hoy} className="mt-1" />
        </label>
        <label>
          Hasta
          <input type="date" name="hasta" defaultValue={hastaISO} max={hoy} className="mt-1" />
        </label>
        <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
          Ver
        </button>
      </form>
      <p className="mb-4 text-sm text-stone-600">
        Suma de los cierres diarios del {formatoDia(desde)} al {formatoDia(hasta)}
        {abiertas > 0 && <strong className="text-amber-800"> · {abiertas} días sin cerrar</strong>}.
      </p>
      <Tabla>
        <thead>
          <tr>
            <th>Día</th>
            <th className="text-right">Base</th>
            <th className="text-right">Cobros efectivo</th>
            <th className="text-right">Otros ingresos</th>
            <th className="text-right">Gastos</th>
            <th className="text-right">Esperado</th>
            <th className="text-right">Contado</th>
            <th className="text-right">Diferencia</th>
            <th className="text-right">Transferencias</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ dia, caja, t }) => {
            const cerrada = caja?.estado === "CERRADA";
            return (
              <tr key={dia.getTime()}>
                <td className="whitespace-nowrap">
                  <Link href={`/caja?dia=${dia.toISOString().slice(0, 10)}`} className="underline">
                    {formatoDia(dia)}
                  </Link>{" "}
                  {!cerrada && <Etiqueta color="ambar">Abierta</Etiqueta>}
                </td>
                <td className="text-right">{formatoPesos(t.base)}</td>
                <td className="text-right">{formatoPesos(t.cobrosEfectivo)}</td>
                <td className="text-right">{formatoPesos(t.ingresosEfectivo)}</td>
                <td className="text-right">{formatoPesos(t.egresosEfectivo)}</td>
                <td className="text-right">{formatoPesos(cerrada ? (caja?.esperado ?? 0) : efectivoEsperado(t))}</td>
                <td className="text-right">{cerrada ? formatoPesos(caja?.contado ?? 0) : "—"}</td>
                <td className={`text-right ${caja?.diferencia ? "text-red-700" : ""}`}>{cerrada ? formatoPesos(caja?.diferencia ?? 0) : "—"}</td>
                <td className="text-right">{formatoPesos(totalTransferencias(t))}</td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td>Total</td>
            <td />
            <td className="text-right">{formatoPesos(totales.cobrosEfectivo)}</td>
            <td className="text-right">{formatoPesos(totales.ingresos)}</td>
            <td className="text-right">{formatoPesos(totales.egresos)}</td>
            <td />
            <td />
            <td className={`text-right ${totales.diferencia ? "text-red-700" : ""}`}>{formatoPesos(totales.diferencia)}</td>
            <td className="text-right">{formatoPesos(totales.transferencias)}</td>
          </tr>
        </tbody>
      </Tabla>
    </>
  );
}
