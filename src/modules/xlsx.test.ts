import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { crc32, generarXlsx, serialExcel } from "./xlsx";

/** Lee un zip sin compresión: nombre → contenido. */
function leerZip(bytes: Uint8Array): Map<string, string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const archivos = new Map<string, string>();
  let i = 0;
  while (v.getUint32(i, true) === 0x04034b50) {
    const metodo = v.getUint16(i + 8, true);
    const tam = v.getUint32(i + 18, true);
    const largoNombre = v.getUint16(i + 26, true);
    const nombre = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + largoNombre));
    const datos = bytes.subarray(i + 30 + largoNombre, i + 30 + largoNombre + tam);
    archivos.set(nombre, new TextDecoder().decode(metodo === 8 ? inflateRawSync(datos) : datos));
    expect(crc32(datos)).toBe(v.getUint32(i + 14, true));
    i += 30 + largoNombre + tam;
  }
  return archivos;
}

describe("xlsx", () => {
  it("crc32 conocido", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("fechas como número de serie de Excel", () => {
    expect(serialExcel("1900-03-01")).toBe(61);
    expect(serialExcel("2026-10-06")).toBe(46301);
  });

  it("arma un libro con encabezado, fechas, pesos y textos escapados", () => {
    const archivos = leerZip(
      generarXlsx({
        nombre: "Libro 2026-09",
        columnas: [{ titulo: "Fecha", tipo: "fecha" }, { titulo: "Concepto" }, { titulo: "Ingreso", tipo: "pesos" }],
        filas: [["2026-10-06", '=HYPERLINK("x") <Tienda & "La 1">', 15000], [null, "Total", 15000]],
        negrilla: [1],
      }),
    );
    expect([...archivos.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    const hoja = archivos.get("xl/worksheets/sheet1.xml")!;
    expect(hoja).toContain('<c r="A1" s="1" t="inlineStr"><is><t>Fecha</t></is></c>');
    expect(hoja).toContain('<c r="A2" s="2"><v>46301</v></c>');
    expect(hoja).toContain("=HYPERLINK(&quot;x&quot;) &lt;Tienda &amp; &quot;La 1&quot;&gt;");
    expect(hoja).not.toContain("<f>");
    expect(hoja).toContain('<c r="C2" s="3"><v>15000</v></c>');
    expect(hoja).toContain('<c r="A3" s="5"/><c r="B3" s="1" t="inlineStr">');
    expect(hoja).toContain('<c r="C3" s="4"><v>15000</v></c>');
    expect(archivos.get("xl/workbook.xml")).toContain('name="Libro 2026-09"');
  });

  it("con encabezado pone el logo arriba y corre la tabla hacia abajo", () => {
    // Solo la cabecera de un PNG de 400 x 100.
    const logo = new Uint8Array(24);
    new DataView(logo.buffer).setUint32(16, 400);
    new DataView(logo.buffer).setUint32(20, 100);
    const archivos = leerZip(
      generarXlsx({
        nombre: "Ventas",
        columnas: [{ titulo: "Cliente" }, { titulo: "Mortalidad", tipo: "porcentaje" }],
        filas: [["Tienda", 2.5]],
        encabezado: { logo, lineas: ["Ventas por cliente", "Del 01/10/2026 al 08/10/2026"] },
      }),
    );
    const hoja = archivos.get("xl/worksheets/sheet1.xml")!;
    // 3 filas de logo, 2 de título y una vacía: los títulos de columna quedan en la fila 7.
    expect(hoja).toContain('<row r="1" ht="18" customHeight="1"/>');
    expect(hoja).toContain('<c r="A4" s="1" t="inlineStr"><is><t xml:space="preserve">Ventas por cliente</t></is></c>');
    expect(hoja).toContain('<row r="7"><c r="A7" s="1"');
    expect(hoja).toContain('<c r="B8" s="6"><v>2.5</v></c>');
    expect(hoja).toContain('ySplit="7" topLeftCell="A8"');
    expect(hoja).toContain('<drawing r:id="rId1"/>');
    expect(archivos.get("xl/drawings/drawing1.xml")).toContain(`<xdr:ext cx="${256 * 9525}" cy="${64 * 9525}"/>`);
    expect(archivos.get("xl/drawings/_rels/drawing1.xml.rels")).toContain('Target="../media/logo.png"');
    expect(archivos.has("xl/media/logo.png")).toBe(true);
    expect(archivos.get("[Content_Types].xml")).toContain("/xl/drawings/drawing1.xml");
  });
});
