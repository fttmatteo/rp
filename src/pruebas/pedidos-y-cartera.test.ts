import { describe, expect, it } from "vitest";
import { anularPago, registrarAbono, registrarSaldoInicial } from "@/app/(app)/cartera/acciones";
import { registrarAbonoCliente, registrarVentaDirecta } from "@/app/(app)/ingresos/acciones";
import {
  anularVenta,
  cancelarPedido,
  crearPedido,
  entregarPedido,
  marcarNoEntregado,
  reprogramarPedido,
} from "@/app/(app)/pedidos/acciones";
import { deudasDeClientes, deudasPendientes, saldoCliente, saldosPorCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { leerEntregadas } from "@/lib/entregas";
import { sumarDias } from "@/lib/formato";
import { Redireccion } from "@/pruebas/next";
import { ayer, cliente, comoOperacion, deuda, existencias, fallo, form, hoy, iso, ok, pedido, producto, saldo, stock } from "@/pruebas/datos";

const manana = () => iso(sumarDias(hoy(), 1));

describe("pedidos", () => {
  it("congela el precio especial del cliente al crear el pedido", async () => {
    await comoOperacion("VENTAS");
    const aa = await producto("AA");
    const jumbo = await producto("JUMBO");
    const c = await cliente({ precios: { create: [{ productoId: aa.id, precio: 16_500 }] } });
    const r = crearPedido(c.id, undefined, form({ fechaEntrega: manana(), [`cantidad_${aa.id}`]: 2, [`cantidad_${jumbo.id}`]: 1, nota: "Temprano" }));
    const redireccion = await r.catch((e: Redireccion) => e);
    expect(redireccion).toBeInstanceOf(Redireccion);
    const p = await db.pedido.findFirstOrThrow({ include: { detalles: { orderBy: { productoId: "asc" } } } });
    expect((redireccion as Redireccion).url).toBe(`/pedidos/${p.id}?creado=1`);
    expect(p).toMatchObject({ clienteId: c.id, estado: "PENDIENTE", nota: "Temprano" });
    expect(p.detalles.map((d) => [d.productoId, d.cantidad, d.precioUnitario])).toEqual([
      [jumbo.id, 1, 23_000],
      [aa.id, 2, 16_500],
    ]);
    // Cambiar el precio después no toca el pedido.
    await db.producto.update({ where: { id: jumbo.id }, data: { precioGeneral: 99_000 } });
    expect((await db.detallePedido.findFirstOrThrow({ where: { productoId: jumbo.id } })).precioUnitario).toBe(23_000);
  });

  it("valida cliente, fecha y cantidades", async () => {
    await comoOperacion("VENTAS");
    const aa = await producto("AA");
    const inactivo = await cliente({ activo: false });
    const final = await cliente({ consumidorFinal: true });
    const c = await cliente();
    fallo(await crearPedido(inactivo.id, undefined, form({ fechaEntrega: manana() })), /inactivo/);
    fallo(await crearPedido(final.id, undefined, form({ fechaEntrega: manana() })), /en el punto/);
    fallo(await crearPedido(c.id, undefined, form({ fechaEntrega: iso(ayer()), [`cantidad_${aa.id}`]: 1 })), /fecha/);
    fallo(await crearPedido(c.id, undefined, form({ fechaEntrega: manana() })), /al menos una cantidad/);
    fallo(await crearPedido(c.id, undefined, form({ fechaEntrega: manana(), [`cantidad_${aa.id}`]: "1,5" })), /enteros/);
  });

  it("solo cancela pendientes y el repartidor no crea pedidos", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const p = await pedido(c.id, [["AA", 1]], { creadoPorId: u.id });
    ok(await cancelarPedido(p.id, undefined, form()));
    fallo(await cancelarPedido(p.id, undefined, form()), /pendientes/);
    await comoOperacion("REPARTIDOR");
    await expect(crearPedido(c.id, undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});

describe("entrega de pedidos", () => {
  it("crea la venta, descuenta el inventario y deja fiado lo que no pagó", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente({ diasCredito: 8 });
    await existencias("AA", 300);
    const p = await pedido(c.id, [["AA", 3]], { creadoPorId: u.id });
    ok(await entregarPedido(p.id, undefined, form({ pagado: 20_000, medio: "EFECTIVO" })));

    const venta = await db.venta.findUniqueOrThrow({ where: { pedidoId: p.id } });
    expect(venta).toMatchObject({ consecutivo: 1, total: 54_000, saldo: 34_000, clienteId: c.id });
    expect(venta.vence).toEqual(sumarDias(hoy(), 8));
    expect(await stock("AA")).toBe(300 - 90);
    expect((await db.pedido.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe("ENTREGADO");
    const pago = await db.pago.findFirstOrThrow({ include: { aplicaciones: true } });
    expect(pago).toMatchObject({ consecutivo: 1, valor: 20_000, medio: "EFECTIVO", dia: hoy() });
    expect(pago.aplicaciones).toEqual([{ pagoId: pago.id, ventaId: venta.id, valor: 20_000 }]);
    // Ya no está pendiente.
    fallo(await entregarPedido(p.id, undefined, form()), /ya no está pendiente/);
  });

  it("entrega parcial: cobra solo lo entregado", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    await existencias("AA", 300);
    await existencias("JUMBO", 300);
    const p = await pedido(c.id, [["AA", 3], ["JUMBO", 2]], { creadoPorId: u.id });
    const [aa, jumbo] = p.detalles;
    const r = ok(await entregarPedido(p.id, undefined, form({ [`entregada_${aa.id}`]: 1, [`entregada_${jumbo.id}`]: 0 })));
    expect(r).toMatch(/parcial/);
    expect((await db.venta.findFirstOrThrow()).total).toBe(18_000);
    expect(await stock("AA")).toBe(270);
    expect(await stock("JUMBO")).toBe(300);
    const detalles = await db.detallePedido.findMany({ orderBy: { id: "asc" } });
    expect(detalles.map((d) => d.cantidadEntregada)).toEqual([1, 0]);
  });

  it("no vende lo que no hay en inventario", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    await existencias("AA", 45);
    const p = await pedido(c.id, [["AA", 2]], { creadoPorId: u.id });
    fallo(await entregarPedido(p.id, undefined, form()), /No hay inventario suficiente: AA \(hay 1 cubeta \+ 15 huevos\)/);
    // Nada cambió.
    expect(await db.venta.count()).toBe(0);
    expect((await db.pedido.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe("PENDIENTE");
    expect(await stock("AA")).toBe(45);
  });

  it("si paga de más, el resto abona a la deuda más antigua", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const vieja = await deuda(c.id, u.id, 10_000, sumarDias(hoy(), -20));
    await existencias("AA", 30);
    const p = await pedido(c.id, [["AA", 1]], { creadoPorId: u.id });
    ok(await entregarPedido(p.id, undefined, form({ pagado: 25_000, medio: "TRANSFERENCIA", referencia: "Nequi 123" })));
    const venta = await db.venta.findUniqueOrThrow({ where: { pedidoId: p.id } });
    expect(venta.saldo).toBe(0);
    expect(await saldo(vieja.id)).toBe(3_000);
    expect((await db.pago.findFirstOrThrow()).referencia).toBe("Nequi 123");
  });

  it("no deja pagar más de lo que debe", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    await existencias("AA", 30);
    const p = await pedido(c.id, [["AA", 1]], { creadoPorId: u.id });
    fallo(await entregarPedido(p.id, undefined, form({ pagado: 18_001, medio: "EFECTIVO" })), /mayor que la deuda/);
    fallo(await entregarPedido(p.id, undefined, form({ pagado: 1 })), /medio de pago/);
    fallo(await entregarPedido(999, undefined, form()), /no encontrado/);
  });

  it("no deja cobrar con la caja de hoy cerrada", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    await existencias("AA", 30);
    await db.caja.create({ data: { dia: hoy(), estado: "CERRADA", cerradaPorId: u.id } });
    const p = await pedido(c.id, [["AA", 1]], { creadoPorId: u.id });
    fallo(await entregarPedido(p.id, undefined, form({ pagado: 1_000, medio: "EFECTIVO" })), /ya está cerrada/);
    // A fiado sí se entrega.
    ok(await entregarPedido(p.id, undefined, form()));
  });

  it("no entregado y reprogramado para otro día con los mismos precios", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const p = await pedido(c.id, [["AA", 2]], { creadoPorId: u.id });
    fallo(await marcarNoEntregado(p.id, undefined, form()), /por qué/);
    fallo(await reprogramarPedido(p.id, undefined, form({ fechaEntrega: manana() })), /no entregados/);
    ok(await marcarNoEntregado(p.id, undefined, form({ motivo: "Cerrado" })));
    fallo(await marcarNoEntregado(p.id, undefined, form({ motivo: "Otra vez" })), /ya no está pendiente/);
    fallo(await reprogramarPedido(p.id, undefined, form({ fechaEntrega: "ayer" })), /fecha/);
    const e = await reprogramarPedido(p.id, undefined, form({ fechaEntrega: manana() })).catch((x: Redireccion) => x);
    const nuevo = await db.pedido.findFirstOrThrow({ where: { id: { not: p.id } }, include: { detalles: true } });
    expect((e as Redireccion).url).toBe(`/pedidos/${nuevo.id}?creado=1`);
    expect(nuevo).toMatchObject({ estado: "PENDIENTE", nota: `Reprogramado del pedido #${p.id}` });
    expect(nuevo.detalles.map((d) => [d.cantidad, d.precioUnitario])).toEqual([[2, 18_000]]);
    expect((await db.pedido.findUniqueOrThrow({ where: { id: p.id } })).motivoNoEntrega).toBe("Cerrado");
  });

  it("lee las cantidades entregadas del formulario", () => {
    expect([...leerEntregadas(form({ entregada_3: 2, entregada_4: "", otro: 1 }))]).toEqual([
      [3, 2],
      [4, null],
    ]);
  });
});

describe("anulación de ventas", () => {
  it("devuelve el inventario y quita la deuda; con pagos vivos no se puede", async () => {
    const u = await comoOperacion("ADMIN");
    const c = await cliente();
    await existencias("AA", 60);
    const p = await pedido(c.id, [["AA", 2]], { creadoPorId: u.id });
    ok(await entregarPedido(p.id, undefined, form({ pagado: 1_000, medio: "EFECTIVO" })));
    const venta = await db.venta.findFirstOrThrow();
    expect(await stock("AA")).toBe(0);

    fallo(await anularVenta(venta.id, undefined, form()), /tiene pagos/);
    const pago = await db.pago.findFirstOrThrow();
    ok(await anularPago(pago.id, undefined, form()));
    expect(await saldo(venta.id)).toBe(36_000);

    ok(await anularVenta(venta.id, undefined, form()));
    expect(await db.venta.findUniqueOrThrow({ where: { id: venta.id } })).toMatchObject({ anulada: true, saldo: 0 });
    expect(await stock("AA")).toBe(60);
    expect((await db.pedido.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe("CANCELADO");
    fallo(await anularVenta(venta.id, undefined, form()), /ya estaba anulada/);
    fallo(await anularVenta(999, undefined, form()), /no encontrada/);
  });

  it("ventas no puede anular", async () => {
    await comoOperacion("VENTAS");
    await expect(anularVenta(1, undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});

describe("cartera", () => {
  it("el abono va primero a la deuda más antigua (FIFO)", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const nueva = await deuda(c.id, u.id, 30_000, sumarDias(hoy(), -2));
    const vieja = await deuda(c.id, u.id, 20_000, sumarDias(hoy(), -40));
    ok(await registrarAbono(c.id, undefined, form({ valor: "25.000", medio: "EFECTIVO" })));
    expect(await saldo(vieja.id)).toBe(0);
    expect(await saldo(nueva.id)).toBe(25_000);
    expect(await saldoCliente(c.id)).toBe(25_000);
    expect((await deudasPendientes(c.id)).map((d) => d.id)).toEqual([nueva.id]);
    // El recibo guarda lo que quedó debiendo con ese pago, aunque después abone más.
    ok(await registrarAbono(c.id, undefined, form({ valor: 5_000, medio: "EFECTIVO" })));
    const pagos = await db.pago.findMany({ orderBy: { id: "asc" } });
    expect(pagos.map((p) => p.saldoDespues)).toEqual([25_000, 20_000]);
  });

  it("el abono a un recibo elegido va primero a ese y el resto a la más antigua", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const vieja = await deuda(c.id, u.id, 20_000, sumarDias(hoy(), -40));
    const media = await deuda(c.id, u.id, 10_000, sumarDias(hoy(), -20));
    const nueva = await deuda(c.id, u.id, 5_000, sumarDias(hoy(), -1));
    ok(await registrarAbono(c.id, undefined, form({ valor: 8_000, medio: "EFECTIVO", recibo: nueva.id })));
    expect([await saldo(vieja.id), await saldo(media.id), await saldo(nueva.id)]).toEqual([17_000, 10_000, 0]);
    fallo(await registrarAbono(c.id, undefined, form({ valor: 1, medio: "EFECTIVO", recibo: nueva.id })), /ya no tiene saldo/);
    fallo(await registrarAbono(c.id, undefined, form({ valor: 1, medio: "EFECTIVO", recibo: "1.5x" })), /no es válido/);
    fallo(await registrarAbono(c.id, undefined, form({ valor: 0, medio: "EFECTIVO" })), /mayor que cero/);
    fallo(await registrarAbono(c.id, undefined, form({ valor: 27_001, medio: "EFECTIVO" })), /mayor que la deuda/);
  });

  it("anular un pago devuelve el saldo a cada deuda", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const a = await deuda(c.id, u.id, 10_000, sumarDias(hoy(), -3));
    const b = await deuda(c.id, u.id, 10_000, sumarDias(hoy(), -2));
    ok(await registrarAbono(c.id, undefined, form({ valor: 15_000, medio: "EFECTIVO" })));
    const pago = await db.pago.findFirstOrThrow();
    await expect(anularPago(pago.id, undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));

    await comoOperacion("ADMIN");
    ok(await anularPago(pago.id, undefined, form()));
    expect([await saldo(a.id), await saldo(b.id)]).toEqual([10_000, 10_000]);
    fallo(await anularPago(pago.id, undefined, form()), /ya estaba anulado/);
    fallo(await anularPago(999, undefined, form()), /no encontrado/);
  });

  it("no se anula un pago de una caja cerrada ni de una ruta liquidada", async () => {
    const u = await comoOperacion("ADMIN");
    const c = await cliente();
    await deuda(c.id, u.id, 10_000, ayer());
    const ruta = await db.ruta.create({ data: { fecha: hoy(), repartidorId: u.id, estado: "LIQUIDADA" } });
    ok(await registrarAbono(c.id, undefined, form({ valor: 1_000, medio: "EFECTIVO" })));
    const pago = await db.pago.findFirstOrThrow();
    await db.pago.update({ where: { id: pago.id }, data: { rutaId: ruta.id } });
    fallo(await anularPago(pago.id, undefined, form()), /ruta ya liquidada/);
    await db.ruta.update({ where: { id: ruta.id }, data: { estado: "ABIERTA" } });
    await db.caja.update({ where: { dia: hoy() }, data: { estado: "CERRADA" } });
    fallo(await anularPago(pago.id, undefined, form()), /ya está cerrada/);
  });

  it("el repartidor abona desde su ruta, no desde la cartera", async () => {
    await comoOperacion("REPARTIDOR");
    fallo(await registrarAbono(1, undefined, form()), /Mi ruta/);
    fallo(await registrarAbonoCliente(undefined, form()), /Mi ruta/);
  });

  it("saldo inicial: deuda previa con su vencimiento", async () => {
    await comoOperacion("ADMIN");
    const c = await cliente({ diasCredito: 10 });
    const fecha = iso(sumarDias(hoy(), -5));
    ok(await registrarSaldoInicial(c.id, undefined, form({ valor: 50_000, fecha, nota: "Cuaderno" })));
    const v = await db.venta.findFirstOrThrow();
    expect(v).toMatchObject({ tipo: "SALDO_INICIAL", total: 50_000, saldo: 50_000, nota: "Cuaderno" });
    expect(v.vence).toEqual(sumarDias(sumarDias(hoy(), -5), 10));
    fallo(await registrarSaldoInicial(c.id, undefined, form({ valor: 0, fecha })), /mayor que cero/);
    fallo(await registrarSaldoInicial(c.id, undefined, form({ valor: 1, fecha: "2999-01-01" })), /Fecha/);
    fallo(await registrarSaldoInicial(999, undefined, form({ valor: 1, fecha })), /no encontrado/);
  });

  it("saldos y deudas de varios clientes", async () => {
    const u = await comoOperacion("VENTAS");
    const a = await cliente();
    const b = await cliente();
    await deuda(a.id, u.id, 10_000, sumarDias(hoy(), -30));
    await deuda(a.id, u.id, 5_000, sumarDias(hoy(), -1));
    await deuda(b.id, u.id, 7_000, sumarDias(hoy(), -1));
    expect(await saldosPorCliente()).toEqual(new Map([[a.id, 15_000], [b.id, 7_000]]));
    expect(await saldosPorCliente([b.id])).toEqual(new Map([[b.id, 7_000]]));
    const d = (await deudasDeClientes([a.id], hoy())).get(a.id)!;
    expect(d).toMatchObject({ saldo: 15_000, vencido: 10_000, masAntigua: sumarDias(hoy(), -30) });
    expect(d.deudas).toHaveLength(2);
  });
});

describe("ingresos: venta en el punto y abonos", () => {
  it("al consumidor final se le cobra todo, y se crea una sola vez", async () => {
    await comoOperacion("VENTAS");
    await existencias("AA", 90);
    const aa = await producto("AA");
    fallo(await registrarVentaDirecta(undefined, form({ clienteId: "final", [`cantidad_${aa.id}`]: 2, pagado: 10_000, medio: "EFECTIVO" })), /paga todo/);
    expect(ok(await registrarVentaDirecta(undefined, form({ clienteId: "final", [`cantidad_${aa.id}`]: 2, medio: "EFECTIVO" })))).toMatch(/RP-000001/);
    expect(ok(await registrarVentaDirecta(undefined, form({ clienteId: "final", [`cantidad_${aa.id}`]: 1, medio: "EFECTIVO" })))).toMatch(/RP-000002/);
    expect(await db.cliente.count({ where: { consumidorFinal: true } })).toBe(1);
    const final = await db.cliente.findFirstOrThrow({ where: { consumidorFinal: true } });
    const venta = await db.venta.findFirstOrThrow({ where: { consecutivo: 1 }, include: { pedido: true } });
    expect(venta).toMatchObject({ clienteId: final.id, total: 36_000, saldo: 0 });
    expect(venta.pedido).toMatchObject({ estado: "ENTREGADO", nota: "Venta en el punto" });
    expect(await stock("AA")).toBe(0);
  });

  it("a un cliente registrado le puede quedar fiado", async () => {
    await comoOperacion("VENTAS");
    await existencias("JUMBO", 30);
    const jumbo = await producto("JUMBO");
    const c = await cliente();
    ok(await registrarVentaDirecta(undefined, form({ clienteId: c.id, [`cantidad_${jumbo.id}`]: 1, pagado: 3_000, medio: "EFECTIVO", nota: "Mostrador" })));
    expect(await saldoCliente(c.id)).toBe(20_000);
    fallo(await registrarVentaDirecta(undefined, form({ clienteId: "", medio: "EFECTIVO" })), /Elige el cliente/);
    fallo(await registrarVentaDirecta(undefined, form({ clienteId: c.id, medio: "EFECTIVO" })), /al menos una cantidad/);
  });

  it("el abono desde Ingresos va a las deudas más antiguas", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const vieja = await deuda(c.id, u.id, 4_000, sumarDias(hoy(), -9));
    const nueva = await deuda(c.id, u.id, 4_000, sumarDias(hoy(), -1));
    ok(await registrarAbonoCliente(undefined, form({ clienteId: c.id, valor: 5_000, medio: "TRANSFERENCIA" })));
    expect([await saldo(vieja.id), await saldo(nueva.id)]).toEqual([0, 3_000]);
    fallo(await registrarAbonoCliente(undefined, form({ valor: 5_000, medio: "EFECTIVO" })), /Elige el cliente/);
  });
});
