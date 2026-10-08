// Archivo de Excel (.xlsx) de una sola hoja, sin librerías: el .xlsx es un zip con unos XML.
// Los textos van como texto en línea, así Excel nunca los toma como fórmula.

export type TipoColumnaXlsx = "texto" | "numero" | "fecha" | "pesos" | "porcentaje";
export interface ColumnaXlsx {
  titulo: string;
  tipo?: TipoColumnaXlsx;
  ancho?: number;
}
/** Las fechas van como "AAAA-MM-DD". */
export type CeldaXlsx = string | number | null;

export interface HojaXlsx {
  nombre: string;
  columnas: ColumnaXlsx[];
  filas: CeldaXlsx[][];
  /** Filas que van en negrilla (por ejemplo, el saldo inicial y los totales). */
  negrilla?: number[];
  /** Logo (PNG) arriba a la izquierda y, debajo, unas líneas de título; la tabla empieza después. */
  encabezado?: { logo: Uint8Array; lineas: string[] };
}

// Estilos (índices de cellXfs): 0 normal, 1 negrilla, 2 fecha, 3 pesos, 4 pesos en negrilla, 5 fecha en negrilla,
// 6 porcentaje, 7 porcentaje en negrilla. Los números van con el formato general.
const ESTILO = { texto: 0, numero: 0, fecha: 2, pesos: 3, porcentaje: 6 } as const;
const EN_NEGRILLA = { texto: 1, numero: 1, fecha: 5, pesos: 4, porcentaje: 7 } as const;
/** Filas que ocupa el logo, su alto en puntos y el alto del logo en píxeles (un poco menos que las filas). */
const FILAS_LOGO = 3;
const ALTO_FILA_LOGO = 18;
const ALTO_LOGO_PX = 64;

const xml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** "A", "B", …, "Z", "AA". */
function letra(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Número de serie de Excel para un día "AAAA-MM-DD" (días desde el 30/12/1899). */
export function serialExcel(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function celda(v: CeldaXlsx, ref: string, tipo: TipoColumnaXlsx, negrilla: boolean): string {
  const s = (negrilla ? EN_NEGRILLA : ESTILO)[tipo];
  if (v === null || v === "") return negrilla ? `<c r="${ref}" s="${s}"/>` : "";
  if (typeof v === "number") return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  if (tipo === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `<c r="${ref}" s="${s}"><v>${serialExcel(v)}</v></c>`;
  return texto(ref, v, negrilla);
}

function texto(ref: string, t: string, negrilla: boolean): string {
  return `<c r="${ref}" s="${negrilla ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xml(t)}</t></is></c>`;
}

function hoja(h: HojaXlsx): string {
  const negrilla = new Set(h.negrilla ?? []);
  // Con encabezado: filas del logo, las líneas de título (la primera en negrilla) y una vacía antes de la tabla.
  const lineas = h.encabezado?.lineas ?? [];
  const arriba = h.encabezado
    ? Array.from({ length: FILAS_LOGO }, (_, i) => `<row r="${i + 1}" ht="${ALTO_FILA_LOGO}" customHeight="1"/>`).join("") +
      lineas.map((t, i) => `<row r="${FILAS_LOGO + i + 1}">${texto(`A${FILAS_LOGO + i + 1}`, t, i === 0)}</row>`).join("")
    : "";
  const filaTitulos = h.encabezado ? FILAS_LOGO + lineas.length + 2 : 1;
  const encabezado = h.columnas.map((c, i) => `<c r="${letra(i)}${filaTitulos}" s="1" t="inlineStr"><is><t>${xml(c.titulo)}</t></is></c>`).join("");
  const filas = h.filas
    .map((f, j) => {
      const n = filaTitulos + j + 1;
      const celdas = f.map((v, i) => celda(v, `${letra(i)}${n}`, h.columnas[i]?.tipo ?? "texto", negrilla.has(j))).join("");
      return `<row r="${n}">${celdas}</row>`;
    })
    .join("");
  const anchos = h.columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho ?? 14}" customWidth="1"/>`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${filaTitulos}" topLeftCell="A${filaTitulos + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${anchos}</cols>` +
    `<sheetData>${arriba}<row r="${filaTitulos}">${encabezado}</row>${filas}</sheetData>` +
    (h.encabezado ? `<drawing r:id="rId1"/>` : "") +
    `</worksheet>`
  );
}

const ESTILOS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="&quot;$&quot; #,##0;-&quot;$&quot; #,##0"/><numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="8">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
  `<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="166" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** El logo va anclado a la celda A1 con su tamaño en EMU (1 px = 9525). */
function dibujo(logo: Uint8Array): string {
  // Ancho y alto del PNG, en su cabecera (IHDR).
  const v = new DataView(logo.buffer, logo.byteOffset, logo.byteLength);
  const [ancho, alto] = [v.getUint32(16), v.getUint32(20)];
  const cy = ALTO_LOGO_PX * 9525;
  const cx = Math.round((ancho / alto) * ALTO_LOGO_PX) * 9525;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>` +
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
    `<xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`
  );
}

const relacion = (tipo: string, destino: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${destino}"/>` +
  `</Relationships>`;

export function generarXlsx(h: HojaXlsx): Uint8Array {
  // Excel no acepta en el nombre de la hoja : \ / ? * [ ] ni más de 31 caracteres.
  const nombre = h.nombre.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Hoja1";
  const logo: [string, string | Uint8Array][] = h.encabezado
    ? [
        ["xl/worksheets/_rels/sheet1.xml.rels", relacion("drawing", "../drawings/drawing1.xml")],
        ["xl/drawings/drawing1.xml", dibujo(h.encabezado.logo)],
        ["xl/drawings/_rels/drawing1.xml.rels", relacion("image", "../media/logo.png")],
        ["xl/media/logo.png", h.encabezado.logo],
      ]
    : [];
  return zip([
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Default Extension="png" ContentType="image/png"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        (h.encabezado ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : "") +
        `</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${xml(nombre)}" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ],
    ["xl/styles.xml", ESTILOS],
    ["xl/worksheets/sheet1.xml", hoja(h)],
    ...logo,
  ]);
}

// ---------- Zip sin compresión ----------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip "stored" (sin comprimir): suficiente para un libro de unas cuantas filas y un logo pequeño. */
export function zip(archivos: [string, string | Uint8Array][]): Uint8Array {
  const codificar = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  // 01/01/1980 00:00 en formato DOS.
  const hora = 0;
  const fecha = (0 << 9) | (1 << 5) | 1;

  for (const [nombre, contenido] of archivos) {
    const n = codificar.encode(nombre);
    const datos = typeof contenido === "string" ? codificar.encode(contenido) : contenido;
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true);
    local.setUint16(10, hora, true);
    local.setUint16(12, fecha, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, n.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), n, datos);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, hora, true);
    dir.setUint16(14, fecha, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, datos.length, true);
    dir.setUint32(24, datos.length, true);
    dir.setUint16(28, n.length, true);
    dir.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(dir.buffer), n);

    desplazamiento += 30 + n.length + datos.length;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}
