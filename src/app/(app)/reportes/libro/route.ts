import { hoyISO } from "@/lib/formato";
import { libroDelMes } from "@/lib/libro-db";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { leerMes, nombreMes, rangoMes } from "@/modules/libro";
import { generarXlsx } from "@/modules/xlsx";

/** Libro mensual en Excel: fecha, concepto, ingreso, egreso y saldo. */
export async function GET(req: Request) {
  const sesion = await requerir();
  if (!puede(sesion.operacion, "reportes")) return new Response("Acceso denegado", { status: 403 });
  const actual = hoyISO().slice(0, 7);
  const mes = leerMes(new URL(req.url).searchParams.get("mes")) ?? actual;
  if (mes > actual) return new Response("Ese mes aún no empieza", { status: 400 });

  const libro = await libroDelMes(mes);
  const { desde } = rangoMes(mes);
  const filas = [
    [desde, `Saldo inicial de ${nombreMes(mes)}`, null, null, libro.saldoInicial],
    ...libro.filas.map((f) => [f.fecha, f.concepto, f.ingreso, f.egreso, f.saldo]),
    [null, mes === actual ? `Totales hasta hoy (${nombreMes(mes)} en curso)` : "Totales del mes", libro.ingresos, libro.egresos, libro.saldoFinal],
  ];
  const archivo = generarXlsx({
    nombre: `Libro ${mes}`,
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
      "Content-Disposition": `attachment; filename="libro_${mes}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const dynamic = "force-dynamic";
