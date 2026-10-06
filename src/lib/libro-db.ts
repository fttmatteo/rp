import "server-only";
import { db } from "@/lib/db";
import { diaUTC, formatoConsecutivo } from "@/lib/formato";
import { armarLibro, type Libro, type MovimientoLibro } from "@/modules/libro";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const medio = (m: string) => (m === "EFECTIVO" ? "efectivo" : "transferencia");

/**
 * Libro del periodo (días "AAAA-MM-DD", ambos incluidos) armado con lo que ya guarda la caja: cobros a clientes, ingresos y
 * egresos de caja (gastos, compras, pagos a proveedores, liquidaciones de ruta) y las
 * diferencias de los cierres. El saldo arranca en la base de la primera caja y acumula
 * efectivo y transferencias desde entonces, así cada periodo empieza donde terminó el anterior.
 */
export async function libroDelPeriodo(desde: string, hasta: string): Promise<Libro> {
  const inicio = diaUTC(desde);
  const rango = { gte: inicio, lte: diaUTC(hasta) };
  const antes = { lt: inicio };

  const [primera, pagosAntes, movsAntes, difAntes, pagos, movs, cierres] = await Promise.all([
    db.caja.findFirst({ orderBy: { dia: "asc" }, select: { base: true } }),
    db.pago.aggregate({ where: { dia: antes, anulado: false }, _sum: { valor: true } }),
    db.movimientoCaja.groupBy({ by: ["tipo"], where: { dia: antes, anulado: false }, _sum: { valor: true } }),
    db.caja.aggregate({ where: { dia: antes, estado: "CERRADA" }, _sum: { diferencia: true } }),
    db.pago.findMany({
      where: { dia: rango, anulado: false },
      include: { cliente: { select: { nombre: true } }, aplicaciones: { include: { venta: { select: { consecutivo: true } } } } },
    }),
    db.movimientoCaja.findMany({ where: { dia: rango, anulado: false } }),
    db.caja.findMany({ where: { dia: rango, estado: "CERRADA", diferencia: { not: 0 } } }),
  ]);

  const mov = (tipo: string) => movsAntes.find((m) => m.tipo === tipo)?._sum.valor ?? 0;
  const saldoInicial = (primera?.base ?? 0) + (pagosAntes._sum.valor ?? 0) + mov("INGRESO") - mov("EGRESO") + (difAntes._sum.diferencia ?? 0);

  const movimientos: MovimientoLibro[] = [
    ...pagos.map((p) => {
      const ventas = p.aplicaciones
        .map((a) => a.venta.consecutivo)
        .sort((a, b) => a - b)
        .map((n) => formatoConsecutivo("RP", n));
      const aplica = ventas.length ? ` (${ventas.join(", ")})` : "";
      return {
        dia: iso(p.dia),
        momento: p.fecha.getTime(),
        concepto: `Cobro ${formatoConsecutivo("AB", p.consecutivo)} de ${p.cliente.nombre}${aplica} · ${medio(p.medio)}`,
        ingreso: p.valor,
        egreso: 0,
      };
    }),
    ...movs.map((m) => ({
      dia: iso(m.dia),
      momento: m.fecha.getTime(),
      concepto: `${m.concepto} · ${medio(m.medio)}`,
      ingreso: m.tipo === "INGRESO" ? m.valor : 0,
      egreso: m.tipo === "EGRESO" ? m.valor : 0,
    })),
    ...cierres.map((c) => {
      const d = c.diferencia ?? 0;
      return {
        dia: iso(c.dia),
        // Al final del día, después de todo lo registrado.
        momento: Number.MAX_SAFE_INTEGER,
        concepto: `${d < 0 ? "Faltante" : "Sobrante"} en el cierre de caja${c.observacion ? `: ${c.observacion}` : ""}`,
        ingreso: d > 0 ? d : 0,
        egreso: d < 0 ? -d : 0,
      };
    }),
  ];
  return armarLibro(saldoInicial, movimientos);
}

/** Primer mes con caja o dinero registrado ("AAAA-MM"), o null si aún no hay nada. */
export async function primerMesLibro(): Promise<string | null> {
  const [caja, pago, mov] = await Promise.all([
    db.caja.findFirst({ orderBy: { dia: "asc" }, select: { dia: true } }),
    db.pago.findFirst({ where: { anulado: false }, orderBy: { dia: "asc" }, select: { dia: true } }),
    db.movimientoCaja.findFirst({ where: { anulado: false }, orderBy: { dia: "asc" }, select: { dia: true } }),
  ]);
  const dias = [caja?.dia, pago?.dia, mov?.dia].filter((d): d is Date => !!d).map((d) => iso(d).slice(0, 7));
  return dias.length ? dias.sort()[0] : null;
}

/**
 * Días del periodo que no se pueden pasar al libro porque su caja no está cerrada:
 * cajas abiertas y días con cobros sin caja cerrada. Lista vacía = se puede generar.
 */
export async function diasSinCerrar(desde: string, hasta: string): Promise<string[]> {
  const dia = { gte: diaUTC(desde), lte: diaUTC(hasta) };
  const [cajas, pagos] = await Promise.all([
    db.caja.findMany({ where: { dia }, select: { dia: true, estado: true } }),
    db.pago.groupBy({ by: ["dia"], where: { dia, anulado: false } }),
  ]);
  const cerradas = new Set(cajas.filter((c) => c.estado === "CERRADA").map((c) => iso(c.dia)));
  const pendientes = new Set([...cajas.filter((c) => c.estado !== "CERRADA").map((c) => iso(c.dia)), ...pagos.map((p) => iso(p.dia)).filter((d) => !cerradas.has(d))]);
  return [...pendientes].sort();
}
