// Reglas de cartera (fiado): aplicación de pagos y antigüedad de deudas.
import { ErrorUsuario } from "@/lib/form";

export interface DeudaPendiente {
  id: number;
  saldo: number;
  fecha: Date;
}

export interface Aplicacion {
  ventaId: number;
  valor: number;
}

/**
 * Reparte un pago entre las deudas pendientes, empezando por la más antigua.
 * Lanza un error si el pago es mayor que la deuda total.
 */
export function aplicarPagoFIFO(deudas: DeudaPendiente[], valor: number): Aplicacion[] {
  if (!Number.isInteger(valor) || valor <= 0) throw new ErrorUsuario("El valor del pago debe ser mayor que cero.");
  const total = deudas.reduce((s, d) => s + d.saldo, 0);
  if (valor > total) throw new ErrorUsuario("El pago es mayor que lo que debe el cliente.");

  const ordenadas = [...deudas]
    .filter((d) => d.saldo > 0)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id - b.id);
  const aplicaciones: Aplicacion[] = [];
  let restante = valor;
  for (const deuda of ordenadas) {
    if (restante === 0) break;
    const aplicado = Math.min(deuda.saldo, restante);
    aplicaciones.push({ ventaId: deuda.id, valor: aplicado });
    restante -= aplicado;
  }
  return aplicaciones;
}

export const RANGOS_ANTIGUEDAD = ["0-15", "16-30", "31-60", "+60"] as const;
export type RangoAntiguedad = (typeof RANGOS_ANTIGUEDAD)[number];

export function rangoAntiguedad(fecha: Date, hoy: Date): RangoAntiguedad {
  const dias = Math.floor((hoy.getTime() - fecha.getTime()) / 86_400_000);
  if (dias <= 15) return "0-15";
  if (dias <= 30) return "16-30";
  if (dias <= 60) return "31-60";
  return "+60";
}

export function resumenAntiguedad(deudas: DeudaPendiente[], hoy: Date): Record<RangoAntiguedad, number> {
  const resumen: Record<RangoAntiguedad, number> = { "0-15": 0, "16-30": 0, "31-60": 0, "+60": 0 };
  for (const d of deudas) resumen[rangoAntiguedad(d.fecha, hoy)] += d.saldo;
  return resumen;
}

/** Aviso si la nueva deuda supera el cupo del cliente (null = sin límite). */
export function superaCupo(cupo: number | null, saldoActual: number, nuevaDeuda: number): boolean {
  return cupo !== null && saldoActual + nuevaDeuda > cupo;
}
