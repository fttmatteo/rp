// Reglas de la caja diaria. Solo el efectivo se cuenta; las transferencias se informan aparte.
import { ErrorUsuario } from "@/lib/form";

export interface TotalesCaja {
  base: number;
  cobrosEfectivo: number;
  cobrosTransferencia: number;
  ingresosEfectivo: number;
  ingresosTransferencia: number;
  egresosEfectivo: number;
  egresosTransferencia: number;
}

/** Efectivo que debería haber en caja al cerrar. */
export function efectivoEsperado(t: TotalesCaja): number {
  return t.base + t.cobrosEfectivo + t.ingresosEfectivo - t.egresosEfectivo;
}

export function totalTransferencias(t: TotalesCaja): number {
  return t.cobrosTransferencia + t.ingresosTransferencia - t.egresosTransferencia;
}

/** Valida el cierre: si hay diferencia, se exige una explicación. */
export function validarCierre(esperado: number, contado: number, observacion: string | null): number {
  if (!Number.isInteger(contado) || contado < 0) throw new ErrorUsuario("Escribe el efectivo contado.");
  const diferencia = contado - esperado;
  if (diferencia !== 0 && !observacion)
    throw new ErrorUsuario("Hay una diferencia entre lo esperado y lo contado. Explica el motivo en la observación.");
  return diferencia;
}

/** Quincena que contiene el día "AAAA-MM-DD": del 1 al 15 o del 16 al fin de mes. */
export function quincena(iso: string): { desde: string; hasta: string } {
  const [a, m, d] = iso.split("-").map(Number);
  const mes = String(m).padStart(2, "0");
  if (d <= 15) return { desde: `${a}-${mes}-01`, hasta: `${a}-${mes}-15` };
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${a}-${mes}-16`, hasta: `${a}-${mes}-${ultimo}` };
}
