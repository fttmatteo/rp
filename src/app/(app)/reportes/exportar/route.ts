import { diaUTC, formatoDia, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { CREDITO_DOCUMENTOS, nombreEmpresa } from "@/lib/marca";
import { generarReporte, leerParametros } from "@/lib/reportes";
import { respuestaPdf } from "@/lib/respuesta-pdf";
import { requerir } from "@/lib/sesion";
import { generarTablaPdf } from "@/lib/tabla-pdf";
import { generarXlsx } from "@/modules/xlsx";

export async function GET(req: Request) {
  const sesion = await requerir();
  if (!puede(sesion.operacion, "reportes")) return new Response("Acceso denegado", { status: 403 });
  const url = new URL(req.url);
  const hoy = hoyISO();
  const p = leerParametros(Object.fromEntries(url.searchParams), hoy);
  const reporte = await generarReporte(p.tipo, diaUTC(p.desde), diaUTC(p.hasta), diaUTC(hoy));
  const nombre = `${p.tipo}_${p.desde}_${p.hasta}`;
  const rango = p.tipo === "cartera" ? "" : `Del ${formatoDia(diaUTC(p.desde))} al ${formatoDia(diaUTC(p.hasta))} · `;
  const subtitulo = `${rango}Generado por ${sesion.usuario.nombre}`;

  if (url.searchParams.get("formato") === "pdf") return respuestaPdf(await generarTablaPdf(reporte, subtitulo), nombre);

  const filas = [...reporte.filas, ...(reporte.total ? [reporte.total] : []), ...(reporte.nota ? [[reporte.nota]] : [])];
  const archivo = generarXlsx({
    nombre: reporte.titulo,
    columnas: reporte.columnas.map((c, i) => ({ titulo: c.titulo, tipo: c.tipo, ancho: i === 0 ? 32 : 15 })),
    filas,
    negrilla: reporte.total ? [reporte.filas.length] : [],
    encabezado: { lineas: [nombreEmpresa(), reporte.titulo, subtitulo].filter(Boolean) },
    pie: CREDITO_DOCUMENTOS,
  });
  return new Response(Buffer.from(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const dynamic = "force-dynamic";
