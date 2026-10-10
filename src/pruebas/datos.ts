// Datos de partida para las pruebas de integración.
import bcrypt from "bcryptjs";
import { expect } from "vitest";
import type { Acceso, Prisma } from "@prisma/client";
import { siguienteConsecutivo } from "@/lib/consecutivo";
import { db } from "@/lib/db";
import { registrarMovimientos } from "@/lib/existencias";
import type { EstadoForm } from "@/lib/form";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import type { Operacion } from "@/lib/permisos";
import { crearSesion } from "@/lib/sesion";

export const hoy = () => diaUTC(hoyISO());
export const ayer = () => sumarDias(hoy(), -1);
export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** FormData a partir de un objeto; un arreglo se agrega como varios valores del mismo campo. */
export function form(campos: Record<string, string | number | boolean | (string | number)[] | null | undefined> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (v === null || v === undefined || v === false) continue;
    if (Array.isArray(v)) for (const x of v) f.append(k, String(x));
    else f.append(k, v === true ? "on" : String(v));
  }
  return f;
}

/** Comprueba que la acción salió bien y devuelve su mensaje. */
export function ok(r: EstadoForm): string {
  expect(r?.error, r?.error).toBeUndefined();
  expect(r?.ok).toBeTruthy();
  return r!.ok!;
}

/** Comprueba que la acción falló con un mensaje para el usuario. */
export function fallo(r: EstadoForm, mensaje?: RegExp): string {
  expect(r?.error).toBeTruthy();
  if (mensaje) expect(r!.error).toMatch(mensaje);
  return r!.error!;
}

export async function producto(codigo: string) {
  return db.producto.findUniqueOrThrow({ where: { codigo } });
}

let siguiente = 0;
export async function usuario(accesos: Acceso[], datos: { nombre?: string; usuario?: string; clave?: string; activo?: boolean } = {}) {
  siguiente++;
  return db.usuario.create({
    data: {
      nombre: datos.nombre ?? `Persona ${siguiente}`,
      usuario: datos.usuario ?? `persona${siguiente}`,
      claveHash: await bcrypt.hash(datos.clave ?? "clave-de-prueba", 4),
      accesos,
      activo: datos.activo ?? true,
    },
  });
}

/** Crea un usuario con ese acceso e inicia su sesión (queda en la cookie de la prueba). */
export async function comoOperacion(operacion: Operacion, accesos: Acceso[] = [operacion]) {
  const u = await usuario(accesos);
  await crearSesion(u.id, operacion);
  return u;
}

export async function cliente(datos: Partial<Prisma.ClienteUncheckedCreateInput> = {}) {
  siguiente++;
  return db.cliente.create({ data: { nombre: `Cliente ${siguiente}`, diasCredito: 15, ...datos } });
}

export async function proveedor(datos: Partial<Prisma.ProveedorUncheckedCreateInput> = {}) {
  siguiente++;
  return db.proveedor.create({ data: { nombre: `Proveedor ${siguiente}`, diasCredito: 30, ...datos } });
}

/** Suma existencias de un producto (huevos para las cubetas). */
export async function existencias(codigo: string, unidades: number) {
  const p = await producto(codigo);
  await db.$transaction((tx) => registrarMovimientos(tx, [{ productoId: p.id, cantidad: unidades, tipo: "PRODUCCION" }]));
  return p;
}

export async function stock(codigo: string) {
  return (await producto(codigo)).existencias;
}

/** Pedido pendiente con líneas [código, cantidad] al precio general. */
export async function pedido(
  clienteId: number,
  lineas: [string, number][],
  datos: { creadoPorId: number; fechaEntrega?: Date; rutaId?: number; ordenEnRuta?: number },
) {
  const detalles = [];
  for (const [codigo, cantidad] of lineas) {
    const p = await producto(codigo);
    detalles.push({ productoId: p.id, cantidad, precioUnitario: p.precioGeneral });
  }
  return db.pedido.create({
    data: {
      clienteId,
      fechaEntrega: datos.fechaEntrega ?? hoy(),
      creadoPorId: datos.creadoPorId,
      rutaId: datos.rutaId,
      ordenEnRuta: datos.ordenEnRuta,
      detalles: { create: detalles },
    },
    include: { detalles: true },
  });
}

/** Deuda de un cliente sin pasar por un pedido (como un saldo inicial). */
export async function deuda(clienteId: number, usuarioId: number, valor: number, fecha: Date) {
  const consecutivo = await db.$transaction((tx) => siguienteConsecutivo(tx, "VENTA"));
  return db.venta.create({
    data: { consecutivo, tipo: "SALDO_INICIAL", clienteId, fecha, total: valor, saldo: valor, vence: sumarDias(fecha, 15), usuarioId },
  });
}

export async function saldo(ventaId: number) {
  return (await db.venta.findUniqueOrThrow({ where: { id: ventaId } })).saldo;
}

/** Vuelve a entrar con un usuario que ya existe. */
export async function entrarComo(u: { id: number }, operacion: Operacion) {
  await crearSesion(u.id, operacion);
}
