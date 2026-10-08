"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoLote } from "@prisma/client";
import { auditar } from "@/lib/auditoria";
import { avesPorLote, bloquearGalpones } from "@/lib/aves-db";
import { db, type Tx } from "@/lib/db";
import { bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";

// En pantalla solo hay galpones. Las aves que hay hoy en un galpón son su lote activo (a lo sumo uno);
// cuando salen todas, el lote se cierra solo y el galpón queda vacío para la siguiente entrada.
// Todo cambio de lotes se hace con el galpón bloqueado.

const ESTADOS: EstadoLote[] = ["CRIA", "LEVANTE", "POSTURA", "DESCARTE"];
const TIPOS = ["MUERTE", "DESCARTE", "VENTA", "TRASLADO"] as const;

function leerFecha(form: FormData, campo: string): Date {
  const iso = texto(form, campo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > hoyISO()) throw new ErrorUsuario("Fecha no válida.");
  return diaUTC(iso);
}

function leerEstado(form: FormData): EstadoLote {
  const estado = texto(form, "estado") as EstadoLote;
  if (!ESTADOS.includes(estado)) throw new ErrorUsuario("Elige la etapa de las aves.");
  return estado;
}

/** Datos de una entrada de aves; null si no se escribió la cantidad (galpón que se crea vacío). */
function leerEntrada(form: FormData, obligatoria: boolean) {
  const cantidadInicial = entero(form, "cantidadInicial", "Aves que entraron") ?? 0;
  if (cantidadInicial <= 0) {
    if (obligatoria) throw new ErrorUsuario("Escribe cuántas aves entraron.");
    return null;
  }
  const fechaIngreso = leerFecha(form, "fechaIngreso");
  return {
    cantidadInicial,
    fechaIngreso,
    edadIngresoSemanas: entero(form, "edadIngresoSemanas", "Edad al entrar") ?? 0,
    estado: leerEstado(form),
    raza: textoOpcional(form, "raza"),
    // El nombre del lote ya no se pide: sirve solo para distinguir las entradas de un mismo galpón.
    nombre: `Entrada ${fechaIngreso.toISOString().slice(0, 10)}`,
  };
}

async function crearEntrada(tx: Tx, usuarioId: number, galponId: number, datos: NonNullable<ReturnType<typeof leerEntrada>>) {
  const lote = await tx.lote.create({ data: { ...datos, galponId } });
  await auditar(tx, usuarioId, "Lote", lote.id, "crear", { galponId, ...datos });
}

export async function crearGalpon(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  let id: number;
  try {
    const nombre = texto(form, "nombre");
    if (!nombre) throw new ErrorUsuario("Escribe el nombre del galpón.");
    const capacidad = entero(form, "capacidad", "Capacidad");
    const entrada = leerEntrada(form, false);
    id = await db.$transaction(async (tx) => {
      const g = await tx.galpon.create({ data: { nombre, capacidad } });
      await auditar(tx, sesion.usuario.id, "Galpon", g.id, "crear", { nombre, capacidad });
      if (entrada) await crearEntrada(tx, sesion.usuario.id, g.id, entrada);
      return g.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect(`/aves/${id}`);
}

/** Aves nuevas en un galpón vacío. */
export async function entradaAves(galponId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  try {
    const entrada = leerEntrada(form, true)!;
    await db.$transaction(async (tx) => {
      await bloquearGalpones(tx, [galponId]);
      const galpon = await tx.galpon.findUnique({ where: { id: galponId } });
      if (!galpon || !galpon.activo) throw new ErrorUsuario("El galpón no está en uso.");
      if (await tx.lote.findFirst({ where: { galponId, activo: true } }))
        throw new ErrorUsuario("El galpón ya tiene aves. Para sumar aves de otro galpón usa un traslado.");
      await crearEntrada(tx, sesion.usuario.id, galponId, entrada);
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/aves/${galponId}`);
  return { ok: "Entrada de aves registrada." };
}

/** Muerte, descarte, paso a venta o traslado a otro galpón. El paso a venta suma al inventario de gallinas. */
export async function registrarNovedad(galponId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  let vacio = false;
  let destinoId: number | null = null;
  try {
    const tipo = texto(form, "tipo") as (typeof TIPOS)[number];
    if (!TIPOS.includes(tipo)) throw new ErrorUsuario("Elige qué pasó.");
    const cantidad = entero(form, "cantidad", "Cantidad") ?? 0;
    if (cantidad <= 0) throw new ErrorUsuario("La cantidad debe ser mayor que cero.");
    const fecha = leerFecha(form, "fecha");
    destinoId = tipo === "TRASLADO" ? entero(form, "galponDestinoId", "Galpón de destino") : null;
    if (tipo === "TRASLADO" && (!destinoId || destinoId === galponId)) throw new ErrorUsuario("Elige el galpón al que pasan las aves.");

    await db.$transaction(async (tx) => {
      await bloquearGalpones(tx, destinoId ? [galponId, destinoId] : [galponId]);
      const galpon = await tx.galpon.findUniqueOrThrow({ where: { id: galponId } });
      const lote = await tx.lote.findFirst({ where: { galponId, activo: true } });
      if (!lote) throw new ErrorUsuario("El galpón no tiene aves.");
      let destino = null;
      if (destinoId) {
        const g = await tx.galpon.findUnique({ where: { id: destinoId } });
        if (!g || !g.activo) throw new ErrorUsuario("El galpón de destino no está en uso.");
        // Si el destino está vacío, las aves llegan con la edad y la etapa que traen.
        destino =
          (await tx.lote.findFirst({ where: { galponId: destinoId, activo: true } })) ??
          (await tx.lote.create({
            data: {
              galponId: destinoId,
              nombre: `Traslado desde ${galpon.nombre}`,
              raza: lote.raza,
              fechaIngreso: lote.fechaIngreso,
              edadIngresoSemanas: lote.edadIngresoSemanas,
              cantidadInicial: 0,
              estado: lote.estado,
            },
          }));
      }
      const vivas = (await avesPorLote([lote], tx)).get(lote.id) ?? 0;
      if (cantidad > vivas) throw new ErrorUsuario(`El galpón solo tiene ${vivas} aves.`);
      const novedad = await tx.novedadLote.create({
        data: { loteId: lote.id, fecha, tipo, cantidad, loteDestinoId: destino?.id, nota: textoOpcional(form, "nota"), usuarioId: sesion.usuario.id },
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
            nota: `Del ${galpon.nombre}`,
          },
        ]);
      }
      vacio = cantidad === vivas;
      if (vacio) await tx.lote.update({ where: { id: lote.id }, data: { activo: false } });
      await auditar(tx, sesion.usuario.id, "NovedadLote", novedad.id, "crear", { galponId, tipo, cantidad, galponDestinoId: destinoId });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/aves/${galponId}`);
  if (destinoId) revalidatePath(`/aves/${destinoId}`);
  const venta = texto(form, "tipo") === "VENTA" ? " Las gallinas ya están en el inventario para vender." : "";
  return { ok: `Registrado.${venta}${vacio ? " El galpón quedó vacío." : ""}` };
}

/** Solo el administrador: deshace una novedad equivocada. */
export async function anularNovedad(id: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  const galpones: number[] = [];
  try {
    await db.$transaction(async (tx) => {
      const previa = await tx.novedadLote.findUnique({ where: { id }, include: { lote: true, loteDestino: true } });
      if (!previa) throw new ErrorUsuario("Novedad no encontrada.");
      galpones.push(previa.lote.galponId, ...(previa.loteDestino ? [previa.loteDestino.galponId] : []));
      await bloquearGalpones(tx, galpones);
      const n = await tx.novedadLote.findUniqueOrThrow({ where: { id }, include: { movimientos: true, lote: true, loteDestino: true } });
      if (n.anulada) throw new ErrorUsuario("Esta novedad ya estaba anulada.");
      if (!n.lote.activo && (await tx.lote.findFirst({ where: { galponId: n.lote.galponId, activo: true } })))
        throw new ErrorUsuario("Ese galpón ya tiene aves nuevas. Registra la corrección con otra novedad.");
      if (n.loteDestino) {
        const enDestino = (await avesPorLote([n.loteDestino], tx)).get(n.loteDestino.id) ?? 0;
        if (enDestino < n.cantidad) throw new ErrorUsuario("El galpón de destino ya no tiene esas aves. Registra la corrección con otra novedad.");
        // Si el destino se queda sin aves, queda vacío.
        if (enDestino === n.cantidad) await tx.lote.update({ where: { id: n.loteDestino.id }, data: { activo: false } });
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
      // Las aves vuelven al galpón de origen: si había quedado vacío, vuelve a tenerlas.
      await tx.lote.update({ where: { id: n.loteId }, data: { activo: true } });
      await auditar(tx, sesion.usuario.id, "NovedadLote", id, "anular", { tipo: n.tipo, cantidad: n.cantidad });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  for (const g of new Set(galpones)) revalidatePath(`/aves/${g}`);
  return { ok: "Novedad anulada." };
}

/** Nombre y capacidad del galpón; etapa y nota de las aves que tiene. */
export async function actualizarGalpon(galponId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("aves");
  try {
    const nombre = texto(form, "nombre");
    if (!nombre) throw new ErrorUsuario("Escribe el nombre del galpón.");
    const capacidad = entero(form, "capacidad", "Capacidad");
    const activo = form.get("fueraDeUso") !== "on";
    await db.$transaction(async (tx) => {
      await bloquearGalpones(tx, [galponId]);
      const lote = await tx.lote.findFirst({ where: { galponId, activo: true } });
      if (!activo && lote) throw new ErrorUsuario("Solo se deja fuera de uso un galpón vacío.");
      await tx.galpon.update({ where: { id: galponId }, data: { nombre, capacidad, activo } });
      await auditar(tx, sesion.usuario.id, "Galpon", galponId, "actualizar", { nombre, capacidad, activo });
      if (lote) {
        const estado = leerEstado(form);
        const nota = textoOpcional(form, "nota");
        await tx.lote.update({ where: { id: lote.id }, data: { estado, nota } });
        await auditar(tx, sesion.usuario.id, "Lote", lote.id, "actualizar", { estado, nota });
      }
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/aves/${galponId}`);
  return { ok: "Guardado." };
}
