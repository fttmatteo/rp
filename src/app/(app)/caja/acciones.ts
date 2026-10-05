"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { bloquearCaja, exigirCajaAbierta, obtenerCaja, totalesCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { leerMedio } from "@/lib/pagos";
import { requerir } from "@/lib/sesion";
import { efectivoEsperado, validarCierre } from "@/modules/caja";

function leerDia(diaISO: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaISO) || diaISO > hoyISO()) throw new ErrorUsuario("Día no válido.");
  return diaUTC(diaISO);
}

function refrescar() {
  revalidatePath("/caja");
}

export async function actualizarBase(diaISO: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("caja");
  try {
    const dia = leerDia(diaISO);
    const base = entero(form, "base", "Base");
    if (base === null) throw new ErrorUsuario("Escribe la base.");
    await db.$transaction(async (tx) => {
      await exigirCajaAbierta(tx, dia);
      await tx.caja.update({ where: { dia }, data: { base } });
      await auditar(tx, sesion.usuario.id, "Caja", diaISO, "base", { base });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Base actualizada." };
}

export async function registrarMovimientoCaja(diaISO: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("caja");
  try {
    const dia = leerDia(diaISO);
    const tipo = texto(form, "tipo");
    if (tipo !== "INGRESO" && tipo !== "EGRESO") throw new ErrorUsuario("Elige si es ingreso o gasto.");
    const concepto = texto(form, "concepto");
    if (!concepto) throw new ErrorUsuario("Escribe el concepto.");
    const valor = entero(form, "valor", "Valor") ?? 0;
    if (valor <= 0) throw new ErrorUsuario("El valor debe ser mayor que cero.");
    const { medio } = leerMedio(form);
    await db.$transaction(async (tx) => {
      await exigirCajaAbierta(tx, dia);
      if (tipo === "EGRESO" && medio === "EFECTIVO") {
        const caja = await obtenerCaja(dia, tx);
        const disponible = efectivoEsperado(await totalesCaja(dia, caja.base, tx));
        if (valor > disponible) throw new ErrorUsuario("No hay tanto efectivo en caja para ese gasto.");
      }
      const mov = await tx.movimientoCaja.create({
        data: { dia, tipo, concepto, valor, medio, usuarioId: sesion.usuario.id },
      });
      await auditar(tx, sesion.usuario.id, "MovimientoCaja", mov.id, "crear", { tipo, concepto, valor, medio });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Movimiento registrado." };
}

export async function anularMovimientoCaja(id: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("caja");
  try {
    await db.$transaction(async (tx) => {
      const mov = await tx.movimientoCaja.findUnique({ where: { id } });
      if (!mov) throw new ErrorUsuario("Movimiento no encontrado.");
      if (mov.rutaId) throw new ErrorUsuario("Esta diferencia viene de la liquidación de una ruta. Se corrige reabriendo esa liquidación.");
      await exigirCajaAbierta(tx, mov.dia);
      const r = await tx.movimientoCaja.updateMany({ where: { id, anulado: false }, data: { anulado: true } });
      if (r.count === 0) throw new ErrorUsuario("Este movimiento ya estaba anulado.");
      await auditar(tx, sesion.usuario.id, "MovimientoCaja", id, "anular");
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Movimiento anulado." };
}

export async function cerrarCaja(diaISO: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("caja");
  try {
    const dia = leerDia(diaISO);
    const contado = entero(form, "contado", "Efectivo contado");
    if (contado === null) throw new ErrorUsuario("Escribe el efectivo contado.");
    const observacion = textoOpcional(form, "observacion");
    await db.$transaction(async (tx) => {
      await exigirCajaAbierta(tx, dia);
      const caja = await obtenerCaja(dia, tx);
      const esperado = efectivoEsperado(await totalesCaja(dia, caja.base, tx));
      const diferencia = validarCierre(esperado, contado, observacion);
      await tx.caja.update({
        where: { dia },
        data: {
          estado: "CERRADA",
          esperado,
          contado,
          diferencia,
          observacion,
          cerradaEn: new Date(),
          cerradaPorId: sesion.usuario.id,
        },
      });
      await auditar(tx, sesion.usuario.id, "Caja", diaISO, "cerrar", { esperado, contado, diferencia, observacion });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Caja cerrada." };
}

export async function reabrirCaja(diaISO: string, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  try {
    const dia = leerDia(diaISO);
    await db.$transaction(async (tx) => {
      await bloquearCaja(tx, dia);
      const caja = await tx.caja.findUnique({ where: { dia } });
      if (!caja || caja.estado !== "CERRADA") throw new ErrorUsuario("La caja de ese día no está cerrada.");
      await tx.caja.update({
        where: { dia },
        data: { estado: "ABIERTA", esperado: null, contado: null, diferencia: null, cerradaEn: null, cerradaPorId: null },
      });
      // El cierre anterior queda guardado en la auditoría.
      await auditar(tx, sesion.usuario.id, "Caja", diaISO, "reabrir", {
        esperado: caja.esperado,
        contado: caja.contado,
        diferencia: caja.diferencia,
        observacion: caja.observacion,
      });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Caja reabierta." };
}

/**
 * Marca (o desmarca) una transferencia como confirmada en el banco.
 * No mueve dinero, así que se permite aunque la caja de ese día ya esté cerrada.
 */
export async function verificarTransferencia(
  entidad: "Pago" | "MovimientoCaja",
  id: number,
  verificada: boolean,
  _: EstadoForm,
  _form: FormData,
): Promise<EstadoForm> {
  const sesion = await requerir("caja");
  try {
    const where = { id, medio: "TRANSFERENCIA" as const, anulado: false };
    const data = { verificadoEn: verificada ? new Date() : null };
    await db.$transaction(async (tx) => {
      const r =
        entidad === "Pago" ? await tx.pago.updateMany({ where, data }) : await tx.movimientoCaja.updateMany({ where, data });
      if (r.count === 0) throw new ErrorUsuario("Transferencia no encontrada o anulada.");
      await auditar(tx, sesion.usuario.id, entidad, id, verificada ? "verificar" : "desverificar");
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: verificada ? "Transferencia verificada." : "Verificación quitada." };
}
