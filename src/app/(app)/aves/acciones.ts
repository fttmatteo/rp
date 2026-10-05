"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoLote } from "@prisma/client";
import { auditar } from "@/lib/auditoria";
import { avesPorLote, bloquearLotes } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";

const ESTADOS: EstadoLote[] = ["CRIA", "LEVANTE", "POSTURA", "DESCARTE"];
const TIPOS = ["MUERTE", "DESCARTE", "VENTA", "TRASLADO"] as const;

function leerFecha(form: FormData, campo: string): Date {
  const iso = texto(form, campo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > hoyISO()) throw new ErrorUsuario("Fecha no válida.");
  return diaUTC(iso);
}

export async function crearGalpon(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  try {
    const nombre = texto(form, "nombre");
    if (!nombre) throw new ErrorUsuario("Escribe el nombre del galpón.");
    const capacidad = entero(form, "capacidad", "Capacidad");
    await db.$transaction(async (tx) => {
      const g = await tx.galpon.create({ data: { nombre, capacidad } });
      await auditar(tx, sesion.usuario.id, "Galpon", g.id, "crear", { nombre, capacidad });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/aves");
  return { ok: "Galpón creado." };
}

export async function crearLote(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  let id: number;
  try {
    const galponId = entero(form, "galponId", "Galpón");
    const galpon = galponId ? await db.galpon.findUnique({ where: { id: galponId } }) : null;
    if (!galpon) throw new ErrorUsuario("Elige el galpón.");
    const nombre = texto(form, "nombre");
    if (!nombre) throw new ErrorUsuario("Escribe el nombre o número del lote.");
    const cantidadInicial = entero(form, "cantidadInicial", "Cantidad de aves") ?? 0;
    if (cantidadInicial <= 0) throw new ErrorUsuario("Escribe cuántas aves entraron.");
    const estado = texto(form, "estado") as EstadoLote;
    if (!ESTADOS.includes(estado)) throw new ErrorUsuario("Elige el estado del lote.");
    const datos = {
      galponId: galpon.id,
      nombre,
      raza: textoOpcional(form, "raza"),
      fechaIngreso: leerFecha(form, "fechaIngreso"),
      edadIngresoSemanas: entero(form, "edadIngresoSemanas", "Edad al ingresar") ?? 0,
      cantidadInicial,
      estado,
      nota: textoOpcional(form, "nota"),
    };
    id = await db.$transaction(async (tx) => {
      const lote = await tx.lote.create({ data: datos });
      await auditar(tx, sesion.usuario.id, "Lote", lote.id, "crear", datos);
      return lote.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect(`/aves/${id}`);
}

/** Muerte, descarte, paso a venta o traslado. El paso a venta suma al inventario de gallinas. */
export async function registrarNovedad(loteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  try {
    const tipo = texto(form, "tipo") as (typeof TIPOS)[number];
    if (!TIPOS.includes(tipo)) throw new ErrorUsuario("Elige el tipo de novedad.");
    const cantidad = entero(form, "cantidad", "Cantidad") ?? 0;
    if (cantidad <= 0) throw new ErrorUsuario("La cantidad debe ser mayor que cero.");
    const fecha = leerFecha(form, "fecha");
    const loteDestinoId = tipo === "TRASLADO" ? entero(form, "loteDestinoId", "Lote de destino") : null;
    if (tipo === "TRASLADO" && (!loteDestinoId || loteDestinoId === loteId)) throw new ErrorUsuario("Elige el lote al que pasan las aves.");

    await db.$transaction(async (tx) => {
      await bloquearLotes(tx, loteDestinoId ? [loteId, loteDestinoId] : [loteId]);
      const lote = await tx.lote.findUnique({ where: { id: loteId } });
      if (!lote || !lote.activo) throw new ErrorUsuario("El lote está cerrado.");
      if (loteDestinoId) {
        const destino = await tx.lote.findUnique({ where: { id: loteDestinoId } });
        if (!destino || !destino.activo) throw new ErrorUsuario("El lote de destino no está activo.");
      }
      const vivas = (await avesPorLote([lote], tx)).get(lote.id) ?? 0;
      if (cantidad > vivas) throw new ErrorUsuario(`El lote solo tiene ${vivas} aves.`);
      const novedad = await tx.novedadLote.create({
        data: { loteId, fecha, tipo, cantidad, loteDestinoId, nota: textoOpcional(form, "nota"), usuarioId: sesion.usuario.id },
      });
      if (tipo === "VENTA") {
        const gallina = await tx.producto.findFirst({ where: { tipo: "GALLINA" } });
        if (!gallina) throw new ErrorUsuario("No existe el producto Gallina.");
        await registrarMovimientos(tx, [
          {
            productoId: gallina.id,
            cantidad,
            tipo: "PRODUCCION",
            novedadId: novedad.id,
            usuarioId: sesion.usuario.id,
            nota: `Del lote ${lote.nombre}`,
          },
        ]);
      }
      await auditar(tx, sesion.usuario.id, "NovedadLote", novedad.id, "crear", { loteId, tipo, cantidad, loteDestinoId });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/aves/${loteId}`);
  return {
    ok: texto(form, "tipo") === "VENTA" ? "Registrado. Las gallinas ya están en el inventario para vender." : "Novedad registrada.",
  };
}

/** Solo el administrador: deshace una novedad equivocada. */
export async function anularNovedad(id: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  let loteId: number | undefined;
  try {
    await db.$transaction(async (tx) => {
      const n = await tx.novedadLote.findUnique({ where: { id }, include: { movimientos: true } });
      if (!n) throw new ErrorUsuario("Novedad no encontrada.");
      loteId = n.loteId;
      await bloquearLotes(tx, n.loteDestinoId ? [n.loteId, n.loteDestinoId] : [n.loteId]);
      if (n.anulada) throw new ErrorUsuario("Esta novedad ya estaba anulada.");
      if (n.tipo === "TRASLADO" && n.loteDestinoId) {
        const destino = await tx.lote.findUniqueOrThrow({ where: { id: n.loteDestinoId } });
        if (((await avesPorLote([destino], tx)).get(destino.id) ?? 0) < n.cantidad)
          throw new ErrorUsuario("El lote de destino ya no tiene esas aves. Registra la corrección con otra novedad.");
      }
      const entradas = n.movimientos.filter((m) => m.tipo === "PRODUCCION");
      if (entradas.length > 0) {
        const stock = await bloquearExistencias(
          tx,
          entradas.map((m) => m.productoId),
        );
        for (const m of entradas)
          if ((stock.get(m.productoId) ?? 0) < m.cantidad) throw new ErrorUsuario("No se puede anular: esas gallinas ya se vendieron.");
        await registrarMovimientos(
          tx,
          entradas.map((m) => ({
            productoId: m.productoId,
            cantidad: -m.cantidad,
            tipo: "ANULACION" as const,
            novedadId: id,
            usuarioId: sesion.usuario.id,
            nota: "Anulación de novedad",
          })),
        );
      }
      await tx.novedadLote.update({ where: { id }, data: { anulada: true } });
      // Si el lote estaba cerrado, vuelve a abrirse: recupera aves.
      await tx.lote.update({ where: { id: n.loteId }, data: { activo: true } });
      await auditar(tx, sesion.usuario.id, "NovedadLote", id, "anular", { tipo: n.tipo, cantidad: n.cantidad });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  if (loteId) revalidatePath(`/aves/${loteId}`);
  return { ok: "Novedad anulada." };
}

export async function actualizarLote(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  try {
    const estado = texto(form, "estado") as EstadoLote;
    if (!ESTADOS.includes(estado)) throw new ErrorUsuario("Elige el estado del lote.");
    const activo = form.get("cerrado") !== "on";
    await db.$transaction(async (tx) => {
      await bloquearLotes(tx, [id]);
      const lote = await tx.lote.findUniqueOrThrow({ where: { id } });
      if (!activo && ((await avesPorLote([lote], tx)).get(id) ?? 0) > 0)
        throw new ErrorUsuario("Solo se cierra un lote sin aves. Registra primero su venta, descarte o traslado.");
      await tx.lote.update({ where: { id }, data: { estado, activo, nota: textoOpcional(form, "nota") } });
      await auditar(tx, sesion.usuario.id, "Lote", id, "actualizar", { estado, activo });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/aves/${id}`);
  return { ok: "Lote actualizado." };
}
