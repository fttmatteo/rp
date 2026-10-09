import "server-only";
import { novedadesDe } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { formatoDia, HUEVOS_POR_CUBETA, sumarDias } from "@/lib/formato";
import { avesVivas, bajasPorTipo, porcentajePostura } from "@/modules/aves";
import { rangoAntiguedad, RANGOS_ANTIGUEDAD } from "@/modules/cartera";
import { cantidadEntregada } from "@/modules/reparto";

export type TipoColumna = "texto" | "numero" | "pesos" | "porcentaje";
export interface Columna {
  titulo: string;
  tipo?: TipoColumna;
}
export type Celda = string | number | null;
export interface Reporte {
  titulo: string;
  nota?: string;
  columnas: Columna[];
  filas: Celda[][];
  total?: Celda[];
}

export const REPORTES = {
  "ventas-clientes": "Ventas por cliente",
  "ventas-productos": "Ventas por producto",
  produccion: "Producción propia y comprada",
  galpones: "Galpones: mortalidad y postura",
  cartera: "Cartera por cliente",
  compras: "Compras por proveedor",
} as const;
export type TipoReporte = keyof typeof REPORTES;

export function esTipoReporte(v: unknown): v is TipoReporte {
  return typeof v === "string" && v in REPORTES;
}

const suma = (filas: Celda[][], col: number) => filas.reduce((s, f) => s + (typeof f[col] === "number" ? (f[col] as number) : 0), 0);
const totales = (filas: Celda[][], columnas: Columna[], etiqueta = "Total"): Celda[] =>
  columnas.map((c, i) => (i === 0 ? etiqueta : c.tipo === "pesos" || c.tipo === "numero" ? suma(filas, i) : null));
const cubetas = (huevos: number) => Math.round((huevos / HUEVOS_POR_CUBETA) * 10) / 10;

/** Inicio y fin (exclusivo) de un rango de días en hora de Bogotá, para columnas con hora. */
export function instantes(desde: Date, hasta: Date) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { gte: new Date(`${iso(desde)}T00:00:00-05:00`), lt: new Date(`${iso(sumarDias(hasta, 1))}T00:00:00-05:00`) };
}

async function ventasPorCliente(desde: Date, hasta: Date): Promise<Reporte> {
  const filas = await db.venta.groupBy({
    by: ["clienteId"],
    where: { tipo: "VENTA", anulada: false, fecha: instantes(desde, hasta) },
    _count: true,
    _sum: { total: true, saldo: true },
  });
  const clientes = new Map((await db.cliente.findMany({ where: { id: { in: filas.map((f) => f.clienteId) } } })).map((c) => [c.id, c]));
  const columnas: Columna[] = [{ titulo: "Cliente" }, { titulo: "Zona" }, { titulo: "Ventas", tipo: "numero" }, { titulo: "Valor", tipo: "pesos" }, { titulo: "Aún pendiente", tipo: "pesos" }];
  const datos: Celda[][] = filas
    .map((f) => [clientes.get(f.clienteId)?.nombre ?? "", clientes.get(f.clienteId)?.zona ?? "", f._count, f._sum.total ?? 0, f._sum.saldo ?? 0])
    .sort((a, b) => (b[3] as number) - (a[3] as number));
  return { titulo: REPORTES["ventas-clientes"], columnas, filas: datos, total: totales(datos, columnas) };
}

async function ventasPorProducto(desde: Date, hasta: Date): Promise<Reporte> {
  const ventas = await db.venta.findMany({
    where: { tipo: "VENTA", anulada: false, fecha: instantes(desde, hasta) },
    select: { pedido: { select: { detalles: { include: { producto: true } } } } },
  });
  const porProducto = new Map<number, { nombre: string; orden: number; unidad: string; cantidad: number; valor: number }>();
  for (const v of ventas)
    for (const d of v.pedido?.detalles ?? []) {
      const n = cantidadEntregada(d);
      const p = d.producto;
      const fila = porProducto.get(p.id) ?? {
        nombre: p.nombre,
        orden: p.orden,
        unidad: p.tipo === "CUBETA" ? "cubetas" : p.tipo === "GALLINA" ? "gallinas" : `${p.unidad ?? "bulto"}s`,
        cantidad: 0,
        valor: 0,
      };
      fila.cantidad += n;
      fila.valor += n * d.precioUnitario;
      porProducto.set(p.id, fila);
    }
  const columnas: Columna[] = [{ titulo: "Producto" }, { titulo: "Unidad" }, { titulo: "Cantidad", tipo: "numero" }, { titulo: "Valor", tipo: "pesos" }];
  const filas: Celda[][] = [...porProducto.values()].sort((a, b) => a.orden - b.orden).map((p) => [p.nombre, p.unidad, p.cantidad, p.valor]);
  return { titulo: REPORTES["ventas-productos"], columnas, filas, total: [...totales(filas, columnas)].map((c, i) => (i === 2 ? null : c)) };
}

async function produccion(desde: Date, hasta: Date): Promise<Reporte> {
  const sinAnular = { movimientos: { none: { tipo: "ANULACION" as const } } };
  const [clasificaciones, compras, aVenta, productos] = await Promise.all([
    db.registroClasificacion.findMany({ where: { fecha: { gte: desde, lte: hasta }, ...sinAnular }, include: { detalles: true } }),
    db.compra.findMany({ where: { clasificada: true, anulada: false, dia: { gte: desde, lte: hasta } }, include: { detalles: true } }),
    db.novedadAves.aggregate({ where: { tipo: "VENTA", anulada: false, fecha: { gte: desde, lte: hasta } }, _sum: { cantidad: true } }),
    db.producto.findMany({ orderBy: { orden: "asc" } }),
  ]);
  const propia = new Map<number, number>();
  const comprada = new Map<number, number>();
  const sumar = (m: Map<number, number>, id: number, n: number) => m.set(id, (m.get(id) ?? 0) + n);
  for (const r of clasificaciones) for (const d of r.detalles) sumar(r.compraId ? comprada : propia, d.productoId, d.cantidad);
  for (const c of compras) for (const d of c.detalles) sumar(comprada, d.productoId, d.cantidad);
  const gallina = productos.find((p) => p.tipo === "GALLINA");
  if (gallina) sumar(propia, gallina.id, aVenta._sum.cantidad ?? 0);
  const rotos = clasificaciones.reduce((s, r) => s + r.rotos, 0);

  const columnas: Columna[] = [{ titulo: "Producto" }, { titulo: "Unidad" }, { titulo: "Propia", tipo: "numero" }, { titulo: "Comprada", tipo: "numero" }, { titulo: "Total", tipo: "numero" }];
  const filas: Celda[][] = productos
    .filter((p) => propia.has(p.id) || comprada.has(p.id))
    .map((p) => {
      const conv = (n: number) => (p.tipo === "CUBETA" ? cubetas(n) : n);
      const a = conv(propia.get(p.id) ?? 0);
      const b = conv(comprada.get(p.id) ?? 0);
      return [p.nombre, p.tipo === "CUBETA" ? "cubetas" : p.tipo === "GALLINA" ? "gallinas a venta" : `${p.unidad ?? "bulto"}s`, a, b, Math.round((a + b) * 10) / 10];
    });
  return { titulo: REPORTES.produccion, nota: `Huevos rotos en la clasificación: ${rotos}. Las cubetas se muestran con un decimal (huevos ÷ 30).`, columnas, filas };
}

async function galpones(desde: Date, hasta: Date): Promise<Reporte> {
  const lista = await db.grupoAves.findMany({
    where: { fechaIngreso: { lte: hasta }, OR: [{ activo: true }, { novedades: { some: { fecha: { gte: desde } } } }] },
    include: { galpon: true },
    orderBy: [{ galpon: { nombre: "asc" } }, { fechaIngreso: "asc" }],
  });
  const [novedades, registros] = await Promise.all([
    novedadesDe(lista.map((l) => l.id)),
    db.registroClasificacion.findMany({
      where: { grupoId: { in: lista.map((l) => l.id) }, fecha: { gte: desde, lte: hasta }, movimientos: { none: { tipo: "ANULACION" } } },
      include: { detalles: { include: { producto: true } } },
    }),
  ]);
  const columnas: Columna[] = [
    { titulo: "Galpón" },
    { titulo: "Entrada de las aves" },
    { titulo: "Aves al inicio", tipo: "numero" },
    { titulo: "Muertes", tipo: "numero" },
    { titulo: "Descartes", tipo: "numero" },
    { titulo: "A venta", tipo: "numero" },
    { titulo: "Traslados", tipo: "numero" },
    { titulo: "Aves al final", tipo: "numero" },
    { titulo: "Mortalidad", tipo: "porcentaje" },
    { titulo: "Huevos", tipo: "numero" },
    { titulo: "Postura prom.", tipo: "porcentaje" },
  ];
  const filas: Celda[][] = lista.map((l) => {
    const inicio = avesVivas(l, novedades, sumarDias(desde, -1));
    const fin = avesVivas(l, novedades, hasta);
    const bajas = bajasPorTipo(novedades.filter((n) => n.grupoId === l.id && n.fecha >= desde && n.fecha <= hasta));
    const propios = registros.filter((r) => r.grupoId === l.id);
    const huevos = propios.reduce((s, r) => s + r.rotos + r.detalles.filter((d) => d.producto.tipo === "CUBETA").reduce((x, d) => x + d.cantidad, 0), 0);
    const dias = new Set(propios.map((r) => r.fecha.getTime())).size;
    const base = Math.max(inicio, fin);
    return [
      l.galpon.nombre,
      formatoDia(l.fechaIngreso),
      inicio,
      bajas.MUERTE,
      bajas.DESCARTE,
      bajas.VENTA,
      fin - inicio + bajas.MUERTE + bajas.DESCARTE + bajas.VENTA,
      fin,
      base > 0 ? Math.round((bajas.MUERTE / base) * 1000) / 10 : null,
      huevos,
      dias > 0 ? porcentajePostura(huevos / dias, fin) : null,
    ];
  });
  return { titulo: REPORTES.galpones, nota: "Una fila por cada grupo de aves que estuvo en el galpón en el período. Traslados: aves que llegaron de otros galpones menos las que salieron a otros. Postura promedio: huevos por día con registro ÷ aves al final del período.", columnas, filas };
}

async function cartera(hoy: Date): Promise<Reporte> {
  const deudas = await db.venta.findMany({ where: { anulada: false, saldo: { gt: 0 } }, include: { cliente: true } });
  const porCliente = new Map<number, { nombre: string; telefono: string; rangos: Record<string, number>; vencido: number; total: number }>();
  for (const d of deudas) {
    const f = porCliente.get(d.clienteId) ?? { nombre: d.cliente.nombre, telefono: d.cliente.telefono ?? "", rangos: {}, vencido: 0, total: 0 };
    const r = rangoAntiguedad(d.fecha, hoy);
    f.rangos[r] = (f.rangos[r] ?? 0) + d.saldo;
    if (d.vence < hoy) f.vencido += d.saldo;
    f.total += d.saldo;
    porCliente.set(d.clienteId, f);
  }
  const columnas: Columna[] = [
    { titulo: "Cliente" },
    { titulo: "Teléfono" },
    ...RANGOS_ANTIGUEDAD.map((r) => ({ titulo: `${r} días`, tipo: "pesos" as const })),
    { titulo: "Vencido", tipo: "pesos" },
    { titulo: "Total", tipo: "pesos" },
  ];
  const filas: Celda[][] = [...porCliente.values()]
    .sort((a, b) => b.total - a.total)
    .map((c) => [c.nombre, c.telefono, ...RANGOS_ANTIGUEDAD.map((r) => c.rangos[r] ?? 0), c.vencido, c.total]);
  return { titulo: REPORTES.cartera, nota: `Saldos a hoy (${formatoDia(hoy)}); no depende del rango de fechas.`, columnas, filas, total: totales(filas, columnas) };
}

async function comprasPorProveedor(desde: Date, hasta: Date): Promise<Reporte> {
  const compras = await db.compra.findMany({ where: { anulada: false, dia: { gte: desde, lte: hasta } }, include: { proveedor: true } });
  const porProveedor = new Map<number, { nombre: string; n: number; huevos: number; contado: number; credito: number; saldo: number }>();
  for (const c of compras) {
    const f = porProveedor.get(c.proveedorId) ?? { nombre: c.proveedor.nombre, n: 0, huevos: 0, contado: 0, credito: 0, saldo: 0 };
    f.n++;
    f.huevos += c.huevos;
    if (c.formaPago === "CONTADO") f.contado += c.total;
    else f.credito += c.total;
    f.saldo += c.saldo;
    porProveedor.set(c.proveedorId, f);
  }
  const columnas: Columna[] = [
    { titulo: "Proveedor" },
    { titulo: "Compras", tipo: "numero" },
    { titulo: "Cubetas", tipo: "numero" },
    { titulo: "De contado", tipo: "pesos" },
    { titulo: "A crédito", tipo: "pesos" },
    { titulo: "Aún por pagar", tipo: "pesos" },
  ];
  const filas: Celda[][] = [...porProveedor.values()].map((p) => [p.nombre, p.n, cubetas(p.huevos), p.contado, p.credito, p.saldo]);
  return { titulo: REPORTES.compras, columnas, filas, total: totales(filas, columnas) };
}

export async function generarReporte(tipo: TipoReporte, desde: Date, hasta: Date, hoy: Date): Promise<Reporte> {
  switch (tipo) {
    case "ventas-clientes":
      return ventasPorCliente(desde, hasta);
    case "ventas-productos":
      return ventasPorProducto(desde, hasta);
    case "produccion":
      return produccion(desde, hasta);
    case "galpones":
      return galpones(desde, hasta);
    case "cartera":
      return cartera(hoy);
    case "compras":
      return comprasPorProveedor(desde, hasta);
  }
}

/** Texto de una celda para pantalla y PDF. */
export function formatoCelda(v: Celda, tipo: TipoColumna = "texto"): string {
  if (v === null) return "—";
  if (typeof v === "string") return v;
  if (tipo === "pesos") return "$ " + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
  if (tipo === "porcentaje") return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(v)}%`;
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(v);
}

export interface ParametrosReporte {
  tipo: TipoReporte;
  desde: string;
  hasta: string;
}

/** Tipo y rango de la URL; por defecto el mes en curso. Si las fechas vienen al revés, se ordenan. */
export function leerParametros(p: { tipo?: string; desde?: string; hasta?: string }, hoy: string): ParametrosReporte {
  const valida = (f: string | undefined) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f)) ? f : null);
  let desde = valida(p.desde) ?? `${hoy.slice(0, 8)}01`;
  let hasta = valida(p.hasta) ?? hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return { tipo: esTipoReporte(p.tipo) ? p.tipo : "ventas-clientes", desde, hasta };
}
