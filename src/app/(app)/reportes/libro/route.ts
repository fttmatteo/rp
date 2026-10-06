import { redirect } from "next/navigation";
import { diaUTC, formatoDia, hoyISO } from "@/lib/formato";
import { diasSinCerrar, libroDelPeriodo } from "@/lib/libro-db";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { leerPeriodo, nombreMes } from "@/modules/libro";
import { generarXlsx } from "@/modules/xlsx";

/**
 * Libro en Excel de un mes o de un periodo: fecha, concepto, ingreso, egreso y saldo.
 * Solo sale si todas las cajas del periodo están cerradas; si no, vuelve a Reportes con el aviso.
 */
export async function GET(req: Request) {
  const sesion = await requerir();
  if (!puede(sesion.operacion, "reportes")) return new Response("Acceso denegado", { status: 403 });
  const hoy = hoyISO();
  const q = new URL(req.url).searchParams;
  const { desde, hasta, mes } = leerPeriodo({ mes: q.get("mes"), desde: q.get("desde"), hasta: q.get("hasta") }, hoy);

  if ((await diasSinCerrar(desde, hasta)).length > 0) {
    const volver = new URLSearchParams(mes ? { libroMes: mes } : { libroDesde: desde, libroHasta: hasta });
    redirect(`/reportes?${volver}#libro`);
  }

  const libro = await libroDelPeriodo(desde, hasta);
  const periodo = mes ? nombreMes(mes) : `del ${formatoDia(diaUTC(desde))} al ${formatoDia(diaUTC(hasta))}`;
  const filas = [
    [desde, `Saldo inicial ${mes ? `de ${periodo}` : periodo}`, null, null, libro.saldoInicial],
    ...libro.filas.map((f) => [f.fecha, f.concepto, f.ingreso, f.egreso, f.saldo]),
    [null, hasta === hoy ? `Totales hasta hoy (${periodo})` : `Totales ${mes ? `de ${periodo}` : periodo}`, libro.ingresos, libro.egresos, libro.saldoFinal],
  ];
  const archivo = generarXlsx({
    nombre: mes ? `Libro ${mes}` : `Libro ${desde} a ${hasta}`,
    columnas: [
      { titulo: "Fecha", tipo: "fecha", ancho: 12 },
      { titulo: "Concepto", ancho: 70 },
      { titulo: "Ingreso", tipo: "pesos", ancho: 15 },
      { titulo: "Egreso", tipo: "pesos", ancho: 15 },
      { titulo: "Saldo", tipo: "pesos", ancho: 16 },
    ],
    filas,
    negrilla: [0, filas.length - 1],
  });
  return new Response(Buffer.from(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="libro_${mes ?? `${desde}_${hasta}`}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const dynamic = "force-dynamic";
