// Libro mensual: cada entrada y salida de dinero del mes con su saldo acumulado.

export interface MovimientoLibro {
  dia: string; // "AAAA-MM-DD"
  /** Para ordenar dentro del mismo día (milisegundos). */
  momento: number;
  concepto: string;
  ingreso: number;
  egreso: number;
}

export interface FilaLibro {
  fecha: string;
  concepto: string;
  ingreso: number | null;
  egreso: number | null;
  saldo: number;
}

export interface Libro {
  saldoInicial: number;
  filas: FilaLibro[];
  ingresos: number;
  egresos: number;
  saldoFinal: number;
}

export function armarLibro(saldoInicial: number, movimientos: MovimientoLibro[]): Libro {
  const orden = [...movimientos].sort((a, b) => (a.dia === b.dia ? a.momento - b.momento : a.dia < b.dia ? -1 : 1));
  let saldo = saldoInicial;
  let ingresos = 0;
  let egresos = 0;
  const filas = orden.map((m) => {
    saldo += m.ingreso - m.egreso;
    ingresos += m.ingreso;
    egresos += m.egreso;
    return { fecha: m.dia, concepto: m.concepto, ingreso: m.ingreso || null, egreso: m.egreso || null, saldo };
  });
  return { saldoInicial, filas, ingresos, egresos, saldoFinal: saldo };
}

/** "AAAA-MM" válido, o null. */
export function leerMes(v: string | null | undefined): string | null {
  if (!v || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return null;
  return v;
}

/** Primer y último día del mes "AAAA-MM", como "AAAA-MM-DD". */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Meses desde `primero` hasta `actual` (ambos "AAAA-MM"), del más reciente al más antiguo. */
export function mesesEntre(primero: string, actual: string): string[] {
  const meses: string[] = [];
  let [a, m] = actual.split("-").map(Number);
  for (let mes = actual; mes >= primero && meses.length < 240; ) {
    meses.push(mes);
    m -= 1;
    if (m === 0) [a, m] = [a - 1, 12];
    mes = `${a}-${String(m).padStart(2, "0")}`;
  }
  return meses;
}

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-09" → "septiembre de 2026". */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} de ${a}`;
}
