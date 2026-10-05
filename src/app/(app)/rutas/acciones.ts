"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { exigirCajaAbierta } from "@/lib/caja-db";
import { db, type Tx } from "@/lib/db";
import { diaUTC, formatoDia, hoyISO } from "@/lib/formato";
import { bloquearCliente } from "@/lib/existencias";
import { entero, ErrorUsuario, mensajeError, textoOpcional, type EstadoForm } from "@/lib/form";
import { abonar, leerMedio } from "@/lib/pagos";
import { bloquearRuta, exigirRutaAbierta } from "@/lib/rutas-db";
import { requerir } from "@/lib/sesion";
import { validarCierre } from "@/modules/caja";
import { ordenarPorZona, ordenManual } from "@/modules/rutas";

function refrescar(rutaId?: number) {
  revalidatePath("/rutas");
  if (rutaId) revalidatePath(`/rutas/${rutaId}`);
  revalidatePath("/mi-ruta");
}

async function paradas(tx: Tx, rutaId: number) {
  const pedidos = await tx.pedido.findMany({ where: { rutaId, estado: { not: "CANCELADO" } }, include: { cliente: true } });
  return pedidos.map((p) => ({
    id: p.id,
    zona: p.cliente.zona,
    direccion: p.cliente.direccion,
    cliente: p.cliente.nombre,
    orden: p.ordenEnRuta,
  }));
}

async function numerar(tx: Tx, ids: number[]) {
  for (const [i, id] of ids.entries()) await tx.pedido.update({ where: { id }, data: { ordenEnRuta: i + 1 } });
}

/** Asigna los pedidos marcados a la ruta del repartidor para ese día (la crea si no existe). */
export async function asignarPedidos(fechaISO: string, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("rutas");
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) throw new ErrorUsuario("Fecha no válida.");
    const fecha = diaUTC(fechaISO);
    const repartidorId = entero(form, "repartidorId", "Repartidor");
    const repartidor = repartidorId ? await db.usuario.findUnique({ where: { id: repartidorId } }) : null;
    if (!repartidor || !repartidor.activo || !repartidor.accesos.includes("REPARTIDOR")) throw new ErrorUsuario("Elige el repartidor.");
    const ids = form.getAll("pedido").map(Number).filter(Number.isInteger);
    if (ids.length === 0) throw new ErrorUsuario("Marca al menos un pedido.");

    await db.$transaction(async (tx) => {
      const ruta = await tx.ruta.upsert({
        where: { fecha_repartidorId: { fecha, repartidorId: repartidor.id } },
        create: { fecha, repartidorId: repartidor.id },
        update: {},
      });
      await exigirRutaAbierta(tx, ruta.id);
      const pedidos = await tx.pedido.findMany({ where: { id: { in: ids } }, include: { ruta: true } });
      for (const p of pedidos) {
        if (p.estado !== "PENDIENTE") throw new ErrorUsuario(`El pedido #${p.id} ya no está pendiente.`);
        if (p.fechaEntrega.getTime() !== fecha.getTime()) throw new ErrorUsuario(`El pedido #${p.id} es para otro día.`);
        if (p.ruta && p.ruta.estado !== "ABIERTA") throw new ErrorUsuario(`El pedido #${p.id} está en una ruta ya liquidada.`);
      }
      await tx.pedido.updateMany({ where: { id: { in: ids } }, data: { rutaId: ruta.id, ordenEnRuta: null } });
      // Los nuevos quedan al final, agrupados por zona; los que ya estaban conservan su orden.
      const todas = await paradas(tx, ruta.id);
      const previas = todas.filter((p) => p.orden !== null).sort((a, b) => a.orden! - b.orden!);
      const nuevas = ordenarPorZona(todas.filter((p) => p.orden === null));
      await numerar(tx, [...previas.map((p) => p.id), ...nuevas]);
      await auditar(tx, sesion.usuario.id, "Ruta", ruta.id, "asignar", { pedidos: ids });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Pedidos asignados a la ruta." };
}

export async function quitarDeRuta(pedidoId: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("rutas");
  let rutaId: number | undefined;
  try {
    await db.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido?.rutaId) throw new ErrorUsuario("El pedido no está en una ruta.");
      rutaId = pedido.rutaId;
      await exigirRutaAbierta(tx, pedido.rutaId);
      const r = await tx.pedido.updateMany({ where: { id: pedidoId, estado: "PENDIENTE" }, data: { rutaId: null, ordenEnRuta: null } });
      if (r.count === 0) throw new ErrorUsuario("Solo se quitan pedidos pendientes.");
      await auditar(tx, sesion.usuario.id, "Ruta", pedido.rutaId, "quitar", { pedidoId });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar(rutaId);
  return { ok: "Pedido quitado de la ruta." };
}

/** Ordena todas las paradas por zona o barrio con un clic. */
export async function ordenarRutaPorZona(rutaId: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  await requerir("rutas");
  try {
    await db.$transaction(async (tx) => {
      await exigirRutaAbierta(tx, rutaId);
      await numerar(tx, ordenarPorZona(await paradas(tx, rutaId)));
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar(rutaId);
  return { ok: "Paradas ordenadas por zona." };
}

/** Guarda el orden escrito a mano (campos orden_<id del pedido>). */
export async function guardarOrden(rutaId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  await requerir("rutas");
  try {
    await db.$transaction(async (tx) => {
      await exigirRutaAbierta(tx, rutaId);
      const actuales = await paradas(tx, rutaId);
      const numeros = new Map(actuales.map((p) => [p.id, entero(form, `orden_${p.id}`, `Orden de ${p.cliente}`)]));
      await numerar(tx, ordenManual(actuales, numeros));
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar(rutaId);
  return { ok: "Orden guardado." };
}

/**
 * Liquidación al regresar: el repartidor entrega el efectivo cobrado. Lo pendiente que no
 * se entregó queda como no entregado. Si hay diferencia, se exige la explicación y se registra
 * en la caja de hoy (faltante como gasto, sobrante como ingreso) para que la caja cuadre.
 */
export async function liquidarRuta(rutaId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("rutas");
  try {
    const entregado = entero(form, "entregado", "Efectivo entregado");
    if (entregado === null) throw new ErrorUsuario("Escribe el efectivo que entregó el repartidor.");
    const observacion = textoOpcional(form, "observacion");
    await db.$transaction(async (tx) => {
      const ruta = await exigirRutaAbierta(tx, rutaId);
      const repartidor = await tx.usuario.findUniqueOrThrow({ where: { id: ruta.repartidorId } });
      const cobrado = await tx.pago.aggregate({ where: { rutaId, anulado: false, medio: "EFECTIVO" }, _sum: { valor: true } });
      const esperado = cobrado._sum.valor ?? 0;
      const diferencia = validarCierre(esperado, entregado, observacion);
      const sinEntregar = await tx.pedido.updateMany({
        where: { rutaId, estado: "PENDIENTE" },
        data: { estado: "NO_ENTREGADO", motivoNoEntrega: "Sin entregar al liquidar la ruta" },
      });
      if (diferencia !== 0) {
        const dia = diaUTC(hoyISO());
        await exigirCajaAbierta(tx, dia);
        await tx.movimientoCaja.create({
          data: {
            dia,
            tipo: diferencia < 0 ? "EGRESO" : "INGRESO",
            concepto: `${diferencia < 0 ? "Faltante" : "Sobrante"} en la liquidación de la ruta de ${repartidor.nombre} (${formatoDia(ruta.fecha)})`,
            valor: Math.abs(diferencia),
            medio: "EFECTIVO",
            usuarioId: sesion.usuario.id,
            rutaId,
          },
        });
      }
      await tx.ruta.update({
        where: { id: rutaId },
        data: {
          estado: "LIQUIDADA",
          efectivoEsperado: esperado,
          efectivoEntregado: entregado,
          diferencia,
          observacion,
          liquidadaEn: new Date(),
          liquidadaPorId: sesion.usuario.id,
        },
      });
      await auditar(tx, sesion.usuario.id, "Ruta", rutaId, "liquidar", {
        esperado,
        entregado,
        diferencia,
        observacion,
        sinEntregar: sinEntregar.count,
      });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar(rutaId);
  return { ok: "Ruta liquidada." };
}

/** Solo el administrador: deshace la liquidación (anula la diferencia registrada en caja). */
export async function reabrirRuta(rutaId: number, _: EstadoForm, _form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("anular");
  try {
    await db.$transaction(async (tx) => {
      const ruta = await bloquearRuta(tx, rutaId);
      if (ruta.estado !== "LIQUIDADA") throw new ErrorUsuario("La ruta no está liquidada.");
      const diferencias = await tx.movimientoCaja.findMany({ where: { rutaId, anulado: false } });
      for (const m of diferencias) {
        await exigirCajaAbierta(tx, m.dia);
        await tx.movimientoCaja.update({ where: { id: m.id }, data: { anulado: true } });
      }
      await tx.ruta.update({
        where: { id: rutaId },
        data: {
          estado: "ABIERTA",
          efectivoEsperado: null,
          efectivoEntregado: null,
          diferencia: null,
          liquidadaEn: null,
          liquidadaPorId: null,
        },
      });
      await auditar(tx, sesion.usuario.id, "Ruta", rutaId, "reabrir", {
        esperado: ruta.efectivoEsperado,
        entregado: ruta.efectivoEntregado,
        diferencia: ruta.diferencia,
        observacion: ruta.observacion,
      });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar(rutaId);
  return { ok: "Liquidación reabierta. Los pedidos no entregados siguen así; se pueden reprogramar." };
}

/** Abono a deudas anteriores cobrado en una parada de la ruta. */
export async function abonoEnRuta(rutaId: number, clienteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("pagos.registrar");
  try {
    const valor = entero(form, "valor", "Valor") ?? 0;
    const { medio, referencia } = leerMedio(form);
    await db.$transaction(async (tx) => {
      await bloquearCliente(tx, clienteId);
      const ruta = await exigirRutaAbierta(tx, rutaId);
      if (sesion.operacion === "REPARTIDOR" && ruta.repartidorId !== sesion.usuario.id) throw new ErrorUsuario("Esta no es tu ruta.");
      const { pago, aplicaciones } = await abonar(tx, {
        clienteId,
        usuarioId: sesion.usuario.id,
        valor,
        medio,
        referencia,
        ventaId: null,
        rutaId,
      });
      await auditar(tx, sesion.usuario.id, "Pago", pago.id, "abono", { valor, medio, aplicaciones, rutaId });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar(rutaId);
  return { ok: "Abono registrado." };
}
