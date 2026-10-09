"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EtapaAves } from "@prisma/client";
import { auditar } from "@/lib/auditoria";
import { avesPorGrupo, bloquearGalpones } from "@/lib/aves-db";
import { db, type Tx } from "@/lib/db";
import { bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { diaUTC, hoyISO } from "@/lib/formato";
import { entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";

// En pantalla solo hay galpones. Las aves que hay hoy en un galpón son su grupo activo (a lo sumo uno);
// cuando salen todas, el grupo se cierra solo y el galpón queda vacío para la siguiente entrada.
// Todo cambio de grupos se hace con el galpón bloqueado.

const ETAPAS: EtapaAves[] = ["CRIA", "LEVANTE", "POSTURA", "DESCARTE"];
const TIPOS = ["MUERTE", "DESCARTE", "VENTA", "TRASLADO"] as const;

function leerFecha(form: FormData, campo: string): Date {
  const iso = texto(form, campo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > hoyISO()) throw new ErrorUsuario("Fecha no válida.");
  return diaUTC(iso);
}

function leerEtapa(form: FormData): EtapaAves {
  const etapa = texto(form, "etapa") as EtapaAves;
  if (!ETAPAS.includes(etapa)) throw new ErrorUsuario("Elige la etapa de las aves.");
  return etapa;
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
    etapa: leerEtapa(form),
    raza: textoOpcional(form, "raza"),
  };
}

async function crearEntrada(tx: Tx, usuarioId: number, galponId: number, datos: NonNullable<ReturnType<typeof leerEntrada>>) {
  const grupo = await tx.grupoAves.create({ data: { ...datos, galponId } });
  await auditar(tx, usuarioId, "GrupoAves", grupo.id, "crear", { galponId, ...datos });
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
      if (await tx.grupoAves.findFirst({ where: { galponId, activo: true } }))
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
      const grupo = await tx.grupoAves.findFirst({ where: { galponId, activo: true } });
      if (!grupo) throw new ErrorUsuario("El galpón no tiene aves.");
      let destino = null;
      if (destinoId) {
        const g = await tx.galpon.findUnique({ where: { id: destinoId } });
        if (!g || !g.activo) throw new ErrorUsuario("El galpón de destino no está en uso.");
        // Si el destino está vacío, las aves llegan con la edad y la etapa que traen.
        destino =
          (await tx.grupoAves.findFirst({ where: { galponId: destinoId, activo: true } })) ??
          (await tx.grupoAves.create({
            data: {
              galponId: destinoId,
              raza: grupo.raza,
              fechaIngreso: grupo.fechaIngreso,
              edadIngresoSemanas: grupo.edadIngresoSemanas,
              cantidadInicial: 0,
              etapa: grupo.etapa,
            },
          }));
      }
      const vivas = (await avesPorGrupo([grupo], tx)).get(grupo.id) ?? 0;
      if (cantidad > vivas) throw new ErrorUsuario(`El galpón solo tiene ${vivas} aves.`);
      const novedad = await tx.novedadAves.create({
        data: { grupoId: grupo.id, fecha, tipo, cantidad, grupoDestinoId: destino?.id, nota: textoOpcional(form, "nota"), usuarioId: sesion.usuario.id },
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
      if (vacio) await tx.grupoAves.update({ where: { id: grupo.id }, data: { activo: false } });
      await auditar(tx, sesion.usuario.id, "NovedadAves", novedad.id, "crear", { galponId, tipo, cantidad, galponDestinoId: destinoId });
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
      const previa = await tx.novedadAves.findUnique({ where: { id }, include: { grupo: true, grupoDestino: true } });
      if (!previa) throw new ErrorUsuario("Novedad no encontrada.");
      galpones.push(previa.grupo.galponId, ...(previa.grupoDestino ? [previa.grupoDestino.galponId] : []));
      await bloquearGalpones(tx, galpones);
      const n = await tx.novedadAves.findUniqueOrThrow({ where: { id }, include: { movimientos: true, grupo: true, grupoDestino: true } });
      if (n.anulada) throw new ErrorUsuario("Esta novedad ya estaba anulada.");
      if (!n.grupo.activo && (await tx.grupoAves.findFirst({ where: { galponId: n.grupo.galponId, activo: true } })))
        throw new ErrorUsuario("Ese galpón ya tiene aves nuevas. Registra la corrección con otra novedad.");
      if (n.grupoDestino) {
        const enDestino = (await avesPorGrupo([n.grupoDestino], tx)).get(n.grupoDestino.id) ?? 0;
        if (enDestino < n.cantidad) throw new ErrorUsuario("El galpón de destino ya no tiene esas aves. Registra la corrección con otra novedad.");
        // Si el destino se queda sin aves, queda vacío.
        if (enDestino === n.cantidad) await tx.grupoAves.update({ where: { id: n.grupoDestino.id }, data: { activo: false } });
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
      await tx.novedadAves.update({ where: { id }, data: { anulada: true } });
      // Las aves vuelven al galpón de origen: si había quedado vacío, vuelve a tenerlas.
      await tx.grupoAves.update({ where: { id: n.grupoId }, data: { activo: true } });
      await auditar(tx, sesion.usuario.id, "NovedadAves", id, "anular", { tipo: n.tipo, cantidad: n.cantidad });
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
      const grupo = await tx.grupoAves.findFirst({ where: { galponId, activo: true } });
      if (!activo && grupo) throw new ErrorUsuario("Solo se deja fuera de uso un galpón vacío.");
      await tx.galpon.update({ where: { id: galponId }, data: { nombre, capacidad, activo } });
      await auditar(tx, sesion.usuario.id, "Galpon", galponId, "actualizar", { nombre, capacidad, activo });
      if (grupo) {
        const etapa = leerEtapa(form);
        const nota = textoOpcional(form, "nota");
        await tx.grupoAves.update({ where: { id: grupo.id }, data: { etapa, nota } });
        await auditar(tx, sesion.usuario.id, "GrupoAves", grupo.id, "actualizar", { etapa, nota });
      }
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/aves/${galponId}`);
  return { ok: "Guardado." };
}
