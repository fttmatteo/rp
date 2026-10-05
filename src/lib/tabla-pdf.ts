import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatoCelda, type Reporte } from "@/lib/reportes";

/** Las fuentes estándar del PDF solo tienen caracteres latinos; el resto se reemplaza. */
const limpiar = (t: string) =>
  t.replace(/[\u202f\u2009]/g, " ").replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

function recortar(t: string, ancho: number, font: PDFFont, size: number): string {
  let s = limpiar(t);
  if (font.widthOfTextAtSize(s, size) <= ancho) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > ancho) s = s.slice(0, -1);
  return `${s}...`;
}

/** Reporte en tabla, carta horizontal, con encabezado repetido en cada página. */
export async function generarTablaPdf(r: Reporte, subtitulo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(r.titulo);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gris = rgb(0.35, 0.35, 0.35);
  const [W, H] = [792, 612];
  const margen = 32;
  const ancho = W - margen * 2;
  const size = 8;
  const alto = 13;

  // La primera columna (nombre) ocupa más; el resto se reparte igual.
  const n = r.columnas.length;
  const primera = Math.min(ancho * 0.3, Math.max(ancho / n, 140));
  const resto = n > 1 ? (ancho - primera) / (n - 1) : 0;
  const anchos = r.columnas.map((_, i) => (i === 0 ? primera : resto));
  const xs = anchos.map((_, i) => margen + anchos.slice(0, i).reduce((s, a) => s + a, 0));
  const numerica = r.columnas.map((c) => c.tipo !== undefined && c.tipo !== "texto");

  let page = pdf.addPage([W, H]);
  let y = H - margen;
  let numeroPagina = 1;

  const fila = (celdas: string[], font: PDFFont) => {
    celdas.forEach((t, i) => {
      const s = recortar(t, anchos[i] - 6, font, size);
      const x = numerica[i] ? xs[i] + anchos[i] - 3 - font.widthOfTextAtSize(s, size) : xs[i] + 3;
      page.drawText(s, { x, y, size, font });
    });
    y -= alto;
  };
  const linea = () => page.drawLine({ start: { x: margen, y: y + alto - 3 }, end: { x: margen + ancho, y: y + alto - 3 }, thickness: 0.5, color: gris });
  const pie = () => page.drawText(`Página ${numeroPagina}`, { x: W - margen - 40, y: margen / 2, size: 7, font: normal, color: gris });
  const encabezado = () => {
    fila(
      r.columnas.map((c) => c.titulo),
      negrita,
    );
    linea();
  };

  page.drawText("RP SOFTWARE", { x: margen, y, size: 12, font: negrita });
  y -= 16;
  page.drawText(limpiar(r.titulo), { x: margen, y, size: 11, font: negrita });
  y -= 13;
  page.drawText(limpiar(subtitulo), { x: margen, y, size: 8, font: normal, color: gris });
  y -= 20;
  encabezado();

  for (const f of r.filas) {
    if (y < margen + alto * 2) {
      pie();
      page = pdf.addPage([W, H]);
      numeroPagina++;
      y = H - margen;
      encabezado();
    }
    fila(
      f.map((v, i) => formatoCelda(v, r.columnas[i].tipo)),
      normal,
    );
  }
  if (r.filas.length === 0) fila(["Sin datos en este período."], normal);
  if (r.total) {
    y -= 2;
    linea();
    fila(
      r.total.map((v, i) => (v === null ? "" : formatoCelda(v, r.columnas[i].tipo))),
      negrita,
    );
  }
  if (r.nota) {
    y -= 8;
    page.drawText(recortar(r.nota, ancho, normal, 7), { x: margen, y, size: 7, font: normal, color: gris });
  }
  pie();
  return pdf.save();
}
