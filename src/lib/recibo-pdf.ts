import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { leerLogo } from "@/lib/logo";

export interface LineaRecibo {
  descripcion: string;
  cantidad?: number;
  precio?: number;
  valor: number;
}

export interface DatosRecibo {
  titulo: string;
  numero: string;
  fecha: string;
  cliente: string;
  clienteDetalle?: string;
  lineas: LineaRecibo[];
  total: number;
  resumen: [string, string][];
  anulado?: boolean;
  atendidoPor: string;
}

/** Las fuentes estándar del PDF solo tienen caracteres latinos; el resto se reemplaza. */
const limpiar = (t: string) => t.replace(/[\u202f\u2009]/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

const pesos = (v: number) => "$ " + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

/** Recibo sencillo en PDF, tamaño media carta. */
export async function generarRecibo(d: DatosRecibo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.titulo} ${d.numero}`);
  const page = pdf.addPage([396, 612]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gris = rgb(0.35, 0.35, 0.35);
  const margen = 28;
  const ancho = page.getWidth() - margen * 2;
  let y = page.getHeight() - margen;

  const texto = (t: string, x: number, size = 9, font = normal, color = rgb(0, 0, 0)) =>
    page.drawText(limpiar(t), { x, y, size, font, color });
  const derecha = (t: string, xFin: number, size = 9, font = normal, color = rgb(0, 0, 0)) =>
    page.drawText(limpiar(t), { x: xFin - font.widthOfTextAtSize(limpiar(t), size), y, size, font, color });
  const linea = () => {
    page.drawLine({ start: { x: margen, y: y + 4 }, end: { x: margen + ancho, y: y + 4 }, thickness: 0.5, color: gris });
  };

  // Encabezado: logo a la izquierda; número, tipo de recibo y fecha a la derecha.
  const imagen = await pdf.embedPng(await leerLogo());
  const altoLogo = 40;
  page.drawImage(imagen, { x: margen, y: y + 10 - altoLogo, height: altoLogo, width: (imagen.width / imagen.height) * altoLogo });
  derecha(d.numero, margen + ancho, 12, negrita);
  y -= 15;
  derecha(d.titulo, margen + ancho, 9, normal, gris);
  y -= 12;
  derecha(d.fecha, margen + ancho, 9);
  y -= 30;
  texto("Cliente", margen, 8, normal, gris);
  y -= 12;
  texto(d.cliente.slice(0, 60), margen, 11, negrita);
  if (d.clienteDetalle) {
    y -= 12;
    texto(d.clienteDetalle.slice(0, 70), margen, 8, normal, gris);
  }
  y -= 24;

  const xCant = margen + ancho * 0.55;
  const xPrecio = margen + ancho * 0.78;
  texto("Descripción", margen, 8, negrita);
  if (d.lineas.some((l) => l.cantidad !== undefined)) {
    derecha("Cant.", xCant, 8, negrita);
    derecha("Precio", xPrecio, 8, negrita);
  }
  derecha("Valor", margen + ancho, 8, negrita);
  y -= 6;
  linea();
  y -= 10;
  for (const l of d.lineas) {
    texto(l.descripcion.slice(0, 40), margen);
    if (l.cantidad !== undefined) derecha(String(l.cantidad), xCant);
    if (l.precio !== undefined) derecha(pesos(l.precio), xPrecio);
    derecha(pesos(l.valor), margen + ancho);
    y -= 14;
  }
  linea();
  y -= 10;
  texto("TOTAL", margen, 11, negrita);
  derecha(pesos(d.total), margen + ancho, 11, negrita);
  y -= 20;
  for (const [k, v] of d.resumen) {
    texto(k, margen, 9, normal, gris);
    derecha(v, margen + ancho, 9);
    y -= 13;
  }
  y -= 14;
  texto(`Atendido por: ${d.atendidoPor}`, margen, 8, normal, gris);
  y -= 12;
  texto("Este documento es un recibo; no es una factura electrónica.", margen, 7, normal, gris);

  if (d.anulado) {
    page.drawText("ANULADO", {
      x: 90,
      y: 300,
      size: 64,
      font: negrita,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.25,
      rotate: degrees(30),
    });
  }
  return pdf.save();
}
