"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { bloquearExistencias, registrarMovimientos } from "@/lib/existencias";
import { entero, ErrorUsuario, mensajeError, texto, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";
import { huevosDe } from "@/modules/inventario";

export async function registrarAjuste(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("inventario.ajustar");
  try {
    const productoId = entero(form, "productoId", "Producto");
    const producto = productoId ? await db.producto.findUnique({ where: { id: productoId } }) : null;
    if (!producto) throw new ErrorUsuario("Elige el producto.");
    const tipo = texto(form, "tipo");
    if (tipo !== "AJUSTE" && tipo !== "ROTURA") throw new ErrorUsuario("Tipo de ajuste no válido.");
    const sentido = tipo === "ROTURA" ? -1 : texto(form, "sentido") === "salida" ? -1 : 1;
    const nota = texto(form, "nota");
    if (!nota) throw new ErrorUsuario("Explica el motivo del ajuste.");
    const cantidadBase = entero(form, "cantidad", "Cantidad") ?? 0;
    const unidades = producto.tipo === "CUBETA" ? huevosDe(cantidadBase, entero(form, "sueltos", "Huevos sueltos") ?? 0) : cantidadBase;
    if (unidades <= 0) throw new ErrorUsuario("La cantidad debe ser mayor que cero.");

    await db.$transaction(async (tx) => {
      if (sentido < 0) {
        const disponible = (await bloquearExistencias(tx, [producto.id])).get(producto.id) ?? 0;
        if (disponible < unidades) throw new ErrorUsuario("No hay suficientes existencias para esa salida.");
      }
      const [mov] = await registrarMovimientos(tx, [
        { productoId: producto.id, cantidad: sentido * unidades, tipo, nota, usuarioId: sesion.usuario.id },
      ]);
      await auditar(tx, sesion.usuario.id, "MovimientoInventario", mov.id, "ajuste", { tipo, cantidad: mov.cantidad, nota });
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/inventario");
  return { ok: "Ajuste registrado." };
}
