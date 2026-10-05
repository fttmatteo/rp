"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { decimal, entero, ErrorUsuario, mensajeError, texto, textoOpcional, type EstadoForm } from "@/lib/form";
import { requerir } from "@/lib/sesion";

function leerCliente(form: FormData) {
  const nombre = texto(form, "nombre");
  if (!nombre) throw new ErrorUsuario("Escribe el nombre del cliente.");
  const diasCredito = entero(form, "diasCredito", "Días de crédito");
  if (diasCredito === null) throw new ErrorUsuario("Escribe los días de crédito.");
  return {
    nombre,
    telefono: textoOpcional(form, "telefono"),
    direccion: textoOpcional(form, "direccion"),
    zona: textoOpcional(form, "zona"),
    latitud: decimal(form, "latitud", "Latitud", -90, 90),
    longitud: decimal(form, "longitud", "Longitud", -180, 180),
    notas: textoOpcional(form, "notas"),
    cupoCredito: entero(form, "cupoCredito", "Cupo de crédito"),
    diasCredito,
  };
}

export async function crearCliente(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("clientes.editar");
  let id: number;
  try {
    const datos = leerCliente(form);
    id = await db.$transaction(async (tx) => {
      const c = await tx.cliente.create({ data: datos });
      await auditar(tx, sesion.usuario.id, "Cliente", c.id, "crear", datos);
      return c.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  // Se avisa en la página de destino que quedó creado.
  redirect(`/clientes/${id}?creado=1`);
}

export async function actualizarCliente(id: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("clientes.editar");
  try {
    const datos = { ...leerCliente(form), activo: form.get("activo") === "on" };
    await db.$transaction(async (tx) => {
      await tx.cliente.update({ where: { id }, data: datos });
      await auditar(tx, sesion.usuario.id, "Cliente", id, "actualizar", datos);
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/clientes/${id}`);
  return { ok: "Datos guardados." };
}

/** Precios especiales: un campo por producto; vacío = paga el precio general. */
export async function guardarPreciosCliente(clienteId: number, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerir("precios");
  try {
    const [productos, actuales] = await Promise.all([
      db.producto.findMany(),
      db.precioCliente.findMany({ where: { clienteId } }),
    ]);
    const previo = new Map(actuales.map((p) => [p.productoId, p.precio]));
    await db.$transaction(async (tx) => {
      for (const p of productos) {
        const nuevo = entero(form, `precio_${p.id}`, `Precio de ${p.nombre}`) || null;
        const anterior = previo.get(p.id) ?? null;
        if (nuevo === anterior) continue;
        if (nuevo === null) {
          await tx.precioCliente.delete({ where: { clienteId_productoId: { clienteId, productoId: p.id } } });
        } else {
          await tx.precioCliente.upsert({
            where: { clienteId_productoId: { clienteId, productoId: p.id } },
            create: { clienteId, productoId: p.id, precio: nuevo },
            update: { precio: nuevo },
          });
        }
        await tx.historialPrecio.create({
          data: { productoId: p.id, clienteId, precioAnterior: anterior, precioNuevo: nuevo, usuarioId: sesion.usuario.id },
        });
      }
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Precios especiales guardados." };
}
