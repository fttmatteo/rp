// Formatos para pantalla: pesos colombianos, fechas en hora de Bogotá y cubetas.

export const ZONA_HORARIA = "America/Bogota";
export const HUEVOS_POR_CUBETA = 30;

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatoPesos(valor: number): string {
  return pesos.format(valor);
}

export function formatoFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
}

export function formatoFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

/** Fecha de un campo @db.Date (guardada a medianoche UTC). */
export function formatoDia(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
}

/** Fecha de hoy en Bogotá como "AAAA-MM-DD". */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(ahora);
}

/** "AAAA-MM-DD" a Date a medianoche UTC, para columnas @db.Date. */
export function diaUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

/** Huevos a "3 cubetas + 5 huevos". */
export function formatoHuevos(huevos: number): string {
  const signo = huevos < 0 ? "-" : "";
  const abs = Math.abs(huevos);
  const cubetas = Math.floor(abs / HUEVOS_POR_CUBETA);
  const sueltos = abs % HUEVOS_POR_CUBETA;
  const partes = [`${cubetas} ${cubetas === 1 ? "cubeta" : "cubetas"}`];
  if (sueltos > 0) partes.push(`${sueltos} ${sueltos === 1 ? "huevo" : "huevos"}`);
  return signo + partes.join(" + ");
}

export function formatoCantidad(tipo: "CUBETA" | "GALLINA", cantidad: number): string {
  if (tipo === "CUBETA") return formatoHuevos(cantidad);
  return `${cantidad} ${Math.abs(cantidad) === 1 ? "gallina" : "gallinas"}`;
}

/** Nombre para pedidos y recibos: "Cubeta AA", "Gallina". */
export function nombreProducto(p: { tipo: string; nombre: string }): string {
  return p.tipo === "CUBETA" ? `Cubeta ${p.nombre}` : p.nombre;
}

export function formatoConsecutivo(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(6, "0")}`;
}
