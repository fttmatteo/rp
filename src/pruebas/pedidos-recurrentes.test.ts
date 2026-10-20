import { describe, expect, it } from "vitest";
import { aprobarPedido, aprobarPedidosDeHoy, cancelarPedido, crearPedido, terminarRecurrente } from "@/app/(app)/pedidos/acciones";
import { tomarPedidos } from "@/app/(app)/rutas/acciones";
import { db } from "@/lib/db";
import { sumarDias } from "@/lib/formato";
import { generarPedidosRecurrentes } from "@/lib/recurrentes-db";
import { diaDeLaSemana } from "@/modules/recurrentes";
import { Redireccion } from "@/pruebas/next";
import { ayer, cliente, comoOperacion, fallo, form, hoy, iso, ok, producto } from "@/pruebas/datos";

const manana = () => sumarDias(hoy(), 1);

/** Crea un pedido que se repite esos días y devuelve su recurrente (la acción termina redirigiendo). */
async function crearRecurrente(clienteId: number, dias: number[], campos: Record<string, string | number> = {}, fechaEntrega = hoy()) {
  const aa = await producto("AA");
  const r = await crearPedido(clienteId, undefined, form({ fechaEntrega: iso(fechaEntrega), [`cantidad_${aa.id}`]: 3, dias, ...campos })).catch((e: Redireccion) => e);
  expect(r).toBeInstanceOf(Redireccion);
  return db.pedidoRecurrente.findFirstOrThrow({ where: { clienteId }, include: { detalles: true, pedidos: true } });
}

/** Pedido recurrente ya creado, sin pasar por la acción, para probar la generación sola. */
async function recurrente(clienteId: number, creadoPorId: number, datos: { dias?: number[]; desde?: Date; activo?: boolean } = {}) {
  const aa = await producto("AA");
  return db.pedidoRecurrente.create({
    data: {
      clienteId,
      creadoPorId,
      diasSemana: datos.dias ?? [0, 1, 2, 3, 4, 5, 6],
      desde: datos.desde ?? hoy(),
      activo: datos.activo,
      detalles: { create: [{ productoId: aa.id, cantidad: 2 }] },
    },
  });
}

describe("pedidos recurrentes", () => {
  it("al crear un pedido con días queda recurrente y el primer pedido no necesita aprobación", async () => {
    await comoOperacion("VENTAS");
    const c = await cliente();
    const r = await crearRecurrente(c.id, [diaDeLaSemana(hoy()), diaDeLaSemana(manana())], { nota: "Tienda de la esquina" });
    expect(r).toMatchObject({ activo: true, desde: hoy(), nota: "Tienda de la esquina" });
    expect(r.diasSemana).toHaveLength(2);
    expect(r.detalles.map((d) => d.cantidad)).toEqual([3]);
    expect(r.pedidos).toHaveLength(1);
    expect(r.pedidos[0]).toMatchObject({ estado: "PENDIENTE", fechaEntrega: hoy() });
    expect(await db.auditoria.count({ where: { entidad: "PedidoRecurrente", accion: "crear" } })).toBe(1);
    // Hoy ya tiene su pedido: no se repite.
    expect(await generarPedidosRecurrentes(hoy())).toBe(0);
  });

  it("sin días elegidos (o con días que no existen) es un pedido normal", async () => {
    await comoOperacion("VENTAS");
    const c = await cliente();
    const aa = await producto("AA");
    await crearPedido(c.id, undefined, form({ fechaEntrega: iso(hoy()), [`cantidad_${aa.id}`]: 1, dias: [9, -1] })).catch((e: Redireccion) => e);
    expect(await db.pedidoRecurrente.count()).toBe(0);
    expect((await db.pedido.findFirstOrThrow()).recurrenteId).toBeNull();
  });

  it("cada día elegido se carga solo a Pedidos por aprobar, con el precio del cliente de ese día y una sola vez", async () => {
    const u = await comoOperacion("VENTAS");
    const aa = await producto("AA");
    const c = await cliente();
    const r = await recurrente(c.id, u.id, { dias: [diaDeLaSemana(manana())] });
    // Hoy no es su día.
    expect(await generarPedidosRecurrentes(hoy())).toBe(0);
    await db.precioCliente.create({ data: { clienteId: c.id, productoId: aa.id, precio: 16_000 } });
    // Dos pantallas abiertas al mismo tiempo no lo duplican.
    const creados = await Promise.all([generarPedidosRecurrentes(manana()), generarPedidosRecurrentes(manana())]);
    expect(creados[0] + creados[1]).toBe(1);
    expect(await generarPedidosRecurrentes(manana())).toBe(0);
    const p = await db.pedido.findFirstOrThrow({ where: { recurrenteId: r.id }, include: { detalles: true } });
    expect(p).toMatchObject({ estado: "POR_APROBAR", fechaEntrega: manana(), clienteId: c.id, creadoPorId: u.id });
    expect(p.detalles.map((d) => [d.productoId, d.cantidad, d.precioUnitario])).toEqual([[aa.id, 2, 16_000]]);
    expect(await db.auditoria.count({ where: { entidad: "Pedido", entidadId: String(p.id), accion: "generar_recurrente" } })).toBe(1);
  });

  it("no genera si terminó, si aún no empieza, si el cliente está inactivo o si sus productos ya no se venden", async () => {
    const u = await comoOperacion("VENTAS");
    await recurrente((await cliente()).id, u.id, { activo: false });
    await recurrente((await cliente()).id, u.id, { desde: manana() });
    await recurrente((await cliente({ activo: false })).id, u.id);
    expect(await generarPedidosRecurrentes(hoy())).toBe(0);
    await recurrente((await cliente()).id, u.id);
    await db.producto.update({ where: { codigo: "AA" }, data: { activo: false } });
    expect(await generarPedidosRecurrentes()).toBe(0);
    expect(await db.pedido.count()).toBe(0);
  });

  it("el administrador aprueba y solo entonces el repartidor lo puede tomar", async () => {
    const u = await comoOperacion("VENTAS");
    await recurrente((await cliente()).id, u.id);
    await generarPedidosRecurrentes();
    const p = await db.pedido.findFirstOrThrow();

    await comoOperacion("REPARTIDOR");
    fallo(await tomarPedidos(undefined, form({ pedido: [p.id] })), /otro repartidor o cambió/);

    await comoOperacion("VENTAS");
    await expect(aprobarPedido(p.id, undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));

    await comoOperacion("ADMIN");
    ok(await aprobarPedido(p.id, undefined, form()));
    expect((await db.pedido.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe("PENDIENTE");
    fallo(await aprobarPedido(p.id, undefined, form()), /ya no está por aprobar/);
    expect(await db.auditoria.count({ where: { entidad: "Pedido", accion: "aprobar" } })).toBe(1);

    await comoOperacion("REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [p.id] })));
  });

  it("aprueba de una vez los de hoy, no los de otros días", async () => {
    const u = await comoOperacion("VENTAS");
    await recurrente((await cliente()).id, u.id);
    await recurrente((await cliente()).id, u.id);
    await recurrente((await cliente()).id, u.id, { desde: ayer() });
    await generarPedidosRecurrentes(ayer());
    await generarPedidosRecurrentes(hoy());
    expect(await db.pedido.count({ where: { estado: "POR_APROBAR" } })).toBe(4);

    await expect(aprobarPedidosDeHoy(undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
    await comoOperacion("ADMIN");
    expect(ok(await aprobarPedidosDeHoy(undefined, form()))).toBe("3 pedidos aprobados.");
    expect(await db.pedido.count({ where: { estado: "POR_APROBAR" } })).toBe(1);
    expect(await db.pedido.count({ where: { estado: "POR_APROBAR", fechaEntrega: ayer() } })).toBe(1);
    fallo(await aprobarPedidosDeHoy(undefined, form()), /No hay pedidos/);

    // Con uno solo, el mensaje va en singular.
    const otro = await recurrente((await cliente()).id, u.id);
    await generarPedidosRecurrentes();
    expect(await db.pedido.count({ where: { recurrenteId: otro.id } })).toBe(1);
    expect(ok(await aprobarPedidosDeHoy(undefined, form()))).toBe("1 pedido aprobado.");
  });

  it("un pedido por aprobar se puede cancelar", async () => {
    const u = await comoOperacion("VENTAS");
    await recurrente((await cliente()).id, u.id);
    await generarPedidosRecurrentes();
    const p = await db.pedido.findFirstOrThrow();
    ok(await cancelarPedido(p.id, undefined, form()));
    expect((await db.pedido.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe("CANCELADO");
    // Cancelado sigue contando como el de hoy: no se vuelve a generar.
    expect(await generarPedidosRecurrentes()).toBe(0);
  });

  it("se deja de repetir y lo ya cargado sigue igual", async () => {
    const u = await comoOperacion("VENTAS");
    const r = await recurrente((await cliente()).id, u.id, { desde: ayer() });
    await generarPedidosRecurrentes(ayer());

    await comoOperacion("REPARTIDOR");
    await expect(terminarRecurrente(r.id, undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));

    await comoOperacion("VENTAS");
    ok(await terminarRecurrente(r.id, undefined, form()));
    fallo(await terminarRecurrente(r.id, undefined, form()), /ya no se estaba repitiendo/);
    expect(await generarPedidosRecurrentes()).toBe(0);
    expect(await db.pedido.count({ where: { recurrenteId: r.id } })).toBe(1);
    expect(await db.auditoria.count({ where: { entidad: "PedidoRecurrente", accion: "terminar" } })).toBe(1);
  });
});
