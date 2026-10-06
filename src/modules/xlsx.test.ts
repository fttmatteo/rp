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
});
