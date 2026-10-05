import { diaUTC, formatoDia, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { generarReporte, leerParametros } from "@/lib/reportes";
import { respuestaPdf } from "@/lib/respuesta-pdf";
import { requerir } from "@/lib/sesion";
import { generarTablaPdf } from "@/lib/tabla-pdf";
import { aCsv } from "@/modules/csv";

export async function GET(req: Request) {
  const sesion = await requerir();
  if (!puede(sesion.operacion, "reportes")) return new Response("Acceso denegado", { status: 403 });
  const url = new URL(req.url);
  const hoy = hoyISO();
  const p = leerParametros(Object.fromEntries(url.searchParams), hoy);
  const reporte = await generarReporte(p.tipo, diaUTC(p.desde), diaUTC(p.hasta), diaUTC(hoy));
  const nombre = `${p.tipo}_${p.desde}_${p.hasta}`;

  if (url.searchParams.get("formato") === "pdf") {
    const rango = p.tipo === "cartera" ? "" : `Del ${formatoDia(diaUTC(p.desde))} al ${formatoDia(diaUTC(p.hasta))} · `;
    return respuestaPdf(await generarTablaPdf(reporte, `${rango}Generado por ${sesion.usuario.nombre}`), nombre);
  }
  const filas = reporte.total ? [...reporte.filas, reporte.total] : reporte.filas;
  return new Response(
    aCsv(
      reporte.columnas.map((c) => c.titulo),
      filas,
    ),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export const dynamic = "force-dynamic";
