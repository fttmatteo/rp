import { describe, expect, it } from "vitest";
import { anularClasificacion, registrarClasificacion } from "@/app/(app)/clasificacion/acciones";
import { registrarPagoProveedor } from "@/app/(app)/egresos/acciones";
import { anularCompra, registrarCompra } from "@/app/(app)/egresos/compras";
import { registrarAjuste } from "@/app/(app)/inventario/acciones";
import { anularPagoProveedor, registrarAbonoProveedor } from "@/app/(app)/por-pagar/acciones";
import { db } from "@/lib/db";
import { existencias as existenciasPorProducto } from "@/lib/existencias";
import { sumarDias } from "@/lib/formato";
import { comprasPorPagar, saldosProveedores } from "@/lib/proveedores-db";
import { Redireccion } from "@/pruebas/next";
import { comoOperacion, existencias, fallo, form, hoy, iso, ok, producto, proveedor, stock } from "@/pruebas/datos";

async function baseEnCaja(valor: number, usuarioId: number) {
  await db.caja.create({ data: { dia: hoy(), base: valor } });
  void usuarioId;
}

describe("compras de huevo a proveedores", () => {
  it("clasificada y de contado: entra al inventario y sale de la caja", async () => {
    const u = await comoOperacion("VENTAS");
    await baseEnCaja(500_000, u.id);
    const p = await proveedor({ nombre: "Granja Sol" });
    const aa = await producto("AA");
    const a = await producto("A");
    ok(await registrarCompra(undefined, form({
      proveedorId: p.id, ingreso: "CLASIFICADA", [`cubetas_${aa.id}`]: 10, [`sueltos_${aa.id}`]: 5, [`cubetas_${a.id}`]: 2,
      total: 200_000, formaPago: "CONTADO", medio: "EFECTIVO",
    })));
    expect(await stock("AA")).toBe(305);
    expect(await stock("A")).toBe(60);
    const compra = await db.compra.findFirstOrThrow();
    expect(compra).toMatchObject({ clasificada: true, huevos: 365, porClasificar: 0, total: 200_000, saldo: 0, vence: null });
    const egreso = await db.movimientoCaja.findFirstOrThrow();
    expect(egreso).toMatchObject({ tipo: "EGRESO", valor: 200_000, compraId: compra.id, concepto: "Compra de huevo a Granja Sol" });

    // Anularla devuelve el inventario y el dinero.
    await comoOperacion("ADMIN");
    ok(await anularCompra(compra.id, undefined, form()));
    expect(await stock("AA")).toBe(0);
    expect((await db.movimientoCaja.findUniqueOrThrow({ where: { id: egreso.id } })).anulado).toBe(true);
    fallo(await anularCompra(compra.id, undefined, form()), /ya estaba anulada/);
    fallo(await anularCompra(999, undefined, form()), /no encontrada/);
  });

  it("no se anula si parte del huevo ya se vendió", async () => {
    const u = await comoOperacion("ADMIN");
    await baseEnCaja(0, u.id);
    const p = await proveedor();
    const aa = await producto("AA");
    ok(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "CLASIFICADA", [`cubetas_${aa.id}`]: 1, total: 10_000, formaPago: "CREDITO" })));
    await db.$transaction((tx) => tx.producto.update({ where: { id: aa.id }, data: { existencias: 10 } }));
    fallo(await anularCompra((await db.compra.findFirstOrThrow()).id, undefined, form()), /ya se vendió/);
  });

  it("sin clasificar y a crédito: queda por clasificar y como cuenta por pagar", async () => {
    const u = await comoOperacion("ADMIN");
    const p = await proveedor({ diasCredito: 20 });
    const aa = await producto("AA");
    ok(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "SIN_CLASIFICAR", cubetas: 10, total: 150_000, formaPago: "CREDITO" })));
    const compra = await db.compra.findFirstOrThrow();
    expect(compra).toMatchObject({ clasificada: false, huevos: 300, porClasificar: 300, saldo: 150_000 });
    expect(compra.vence).toEqual(sumarDias(hoy(), 20));
    expect(await stock("AA")).toBe(0);
    expect(await db.movimientoCaja.count()).toBe(0);
    expect(await saldosProveedores()).toEqual(new Map([[p.id, 150_000]]));

    // Se clasifica una parte: suma como compra, no como producción.
    const f = { fecha: iso(hoy()), origen: compra.id, [`cubetas_${aa.id}`]: 9, rotos: 10 };
    fallo(await registrarClasificacion(undefined, form({ ...f, [`cubetas_${aa.id}`]: 10 })), /solo quedan 300/);
    ok(await registrarClasificacion(undefined, form(f)));
    expect(await stock("AA")).toBe(270);
    expect((await db.compra.findUniqueOrThrow({ where: { id: compra.id } })).porClasificar).toBe(20);
    expect((await db.movimientoInventario.findFirstOrThrow({ where: { clasificacionId: { not: null } } })).tipo).toBe("COMPRA");
    fallo(await anularCompra(compra.id, undefined, form()), /Ya se clasificó parte/);

    // Anular la clasificación devuelve los huevos a la compra.
    const registro = await db.registroClasificacion.findFirstOrThrow();
    ok(await anularClasificacion(registro.id, undefined, form()));
    expect((await db.compra.findUniqueOrThrow({ where: { id: compra.id } })).porClasificar).toBe(300);
    expect(await stock("AA")).toBe(0);
    fallo(await anularClasificacion(registro.id, undefined, form()), /ya fue anulado/);
    fallo(await anularClasificacion(999, undefined, form()), /no encontrado/);
    void u;
  });

  it("valida los datos de la compra", async () => {
    await comoOperacion("VENTAS");
    const p = await proveedor();
    const inactivo = await proveedor({ activo: false });
    fallo(await registrarCompra(undefined, form({ proveedorId: inactivo.id })), /Elige el proveedor/);
    fallo(await registrarCompra(undefined, form({ proveedorId: p.id })), /clasificado o sin clasificar/);
    fallo(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "SIN_CLASIFICAR" })), /cuánto huevo/);
    fallo(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "SIN_CLASIFICAR", sueltos: 5 })), /costo total/);
    fallo(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "SIN_CLASIFICAR", sueltos: 5, total: 1 })), /contado o a crédito/);
    // De contado en efectivo sin plata en caja.
    fallo(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "SIN_CLASIFICAR", sueltos: 5, total: 1, formaPago: "CONTADO", medio: "EFECTIVO" })), /No hay tanto efectivo/);
    expect(await db.compra.count()).toBe(0);
  });

  it("abonos a proveedores: FIFO, a una compra elegida y anulación", async () => {
    const u = await comoOperacion("VENTAS");
    await baseEnCaja(100_000, u.id);
    const p = await proveedor({ nombre: "Avícola" });
    for (const total of [30_000, 20_000]) {
      ok(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "SIN_CLASIFICAR", cubetas: 1, total, formaPago: "CREDITO" })));
    }
    const [primera, segunda] = await comprasPorPagar(p.id);
    ok(await registrarPagoProveedor(undefined, form({ proveedorId: p.id, valor: 35_000, medio: "EFECTIVO" })));
    expect((await comprasPorPagar(p.id)).map((c) => [c.id, c.saldo])).toEqual([[segunda.id, 15_000]]);
    const egreso = await db.movimientoCaja.findFirstOrThrow({ where: { pagoProveedorId: { not: null } } });
    expect(egreso).toMatchObject({ valor: 35_000, concepto: "Abono a proveedor Avícola" });
    fallo(await registrarPagoProveedor(undefined, form({ valor: 1, medio: "EFECTIVO" })), /Elige el proveedor/);

    ok(await registrarAbonoProveedor(p.id, undefined, form({ valor: 5_000, medio: "TRANSFERENCIA", compra: segunda.id })));
    expect((await db.compra.findUniqueOrThrow({ where: { id: segunda.id } })).saldo).toBe(10_000);
    fallo(await registrarAbonoProveedor(p.id, undefined, form({ valor: 1, medio: "EFECTIVO", compra: primera.id })), /ya no tiene saldo/);
    fallo(await registrarAbonoProveedor(p.id, undefined, form({ valor: 1, medio: "EFECTIVO", compra: "x" })), /no es válida/);
    fallo(await registrarAbonoProveedor(999, undefined, form({ valor: 1, medio: "EFECTIVO" })), /no encontrado/);

    // Con abonos vivos la compra no se anula.
    await comoOperacion("ADMIN");
    fallo(await anularCompra(segunda.id, undefined, form()), /tiene abonos/);
    const pago = await db.pagoProveedor.findFirstOrThrow({ orderBy: { id: "asc" } });
    ok(await anularPagoProveedor(pago.id, undefined, form()));
    expect((await db.compra.findUniqueOrThrow({ where: { id: primera.id } })).saldo).toBe(30_000);
    expect((await db.compra.findUniqueOrThrow({ where: { id: segunda.id } })).saldo).toBe(15_000);
    expect((await db.movimientoCaja.findUniqueOrThrow({ where: { id: egreso.id } })).anulado).toBe(true);
    fallo(await anularPagoProveedor(pago.id, undefined, form()), /ya estaba anulado/);
    fallo(await anularPagoProveedor(999, undefined, form()), /no encontrado/);
  });

  it("el repartidor no registra compras", async () => {
    await comoOperacion("REPARTIDOR");
    await expect(registrarCompra(undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});

describe("clasificación de la producción propia", () => {
  it("suma al inventario por tipo y se anula mientras no se haya vendido", async () => {
    await comoOperacion("ADMIN");
    const aa = await producto("AA");
    const jumbo = await producto("JUMBO");
    const gallinaza = await producto("GALLINAZA");
    await db.producto.update({ where: { id: gallinaza.id }, data: { activo: true } });
    const galpon = await db.galpon.create({ data: { nombre: "G1" } });
    const grupo = await db.grupoAves.create({ data: { galponId: galpon.id, fechaIngreso: hoy(), cantidadInicial: 100 } });
    ok(await registrarClasificacion(undefined, form({
      fecha: iso(hoy()), [`cubetas_${aa.id}`]: 2, [`sueltos_${jumbo.id}`]: 12, [`unidades_${gallinaza.id}`]: 3, rotos: 4, grupo: grupo.id, nota: "Mañana",
    })));
    const enStock = await existenciasPorProducto();
    expect([enStock.get(aa.id), enStock.get(jumbo.id), enStock.get(gallinaza.id)]).toEqual([60, 12, 3]);
    const r = await db.registroClasificacion.findFirstOrThrow();
    expect(r).toMatchObject({ grupoId: grupo.id, rotos: 4, compraId: null });

    await db.producto.update({ where: { id: aa.id }, data: { existencias: 30 } });
    fallo(await anularClasificacion(r.id, undefined, form()), /ya se vendió/);
  });

  it("valida fecha, cantidades, origen y galpón", async () => {
    await comoOperacion("ADMIN");
    const aa = await producto("AA");
    const gallinaza = await producto("GALLINAZA");
    await db.producto.update({ where: { id: gallinaza.id }, data: { activo: true } });
    fallo(await registrarClasificacion(undefined, form({ fecha: "2999-01-01" })), /Fecha/);
    fallo(await registrarClasificacion(undefined, form({ fecha: iso(hoy()) })), /al menos una cantidad/);
    fallo(await registrarClasificacion(undefined, form({ fecha: iso(hoy()), [`cubetas_${aa.id}`]: 1, origen: "abc" })), /no es válido/);
    fallo(await registrarClasificacion(undefined, form({ fecha: iso(hoy()), [`unidades_${gallinaza.id}`]: 1, origen: 5 })), /solo se clasifican huevos/);
    fallo(await registrarClasificacion(undefined, form({ fecha: iso(hoy()), [`cubetas_${aa.id}`]: 1, origen: 5 })), /no tiene huevo por clasificar/);
    fallo(await registrarClasificacion(undefined, form({ fecha: iso(hoy()), [`cubetas_${aa.id}`]: 1, grupo: 77 })), /ya no tiene aves/);
  });

  it("ventas no clasifica", async () => {
    await comoOperacion("VENTAS");
    await expect(registrarClasificacion(undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});

describe("ajustes de inventario", () => {
  it("entradas, salidas y roturas, sin dejar existencias negativas", async () => {
    await comoOperacion("ADMIN");
    const aa = await producto("AA");
    const gallina = await producto("GALLINA");
    ok(await registrarAjuste(undefined, form({ productoId: aa.id, tipo: "AJUSTE", sentido: "entrada", cantidad: 2, sueltos: 3, nota: "Conteo" })));
    expect(await stock("AA")).toBe(63);
    ok(await registrarAjuste(undefined, form({ productoId: aa.id, tipo: "ROTURA", cantidad: 0, sueltos: 3, nota: "Se cayeron" })));
    expect(await stock("AA")).toBe(60);
    fallo(await registrarAjuste(undefined, form({ productoId: aa.id, tipo: "AJUSTE", sentido: "salida", cantidad: 3, nota: "x" })), /No hay suficientes/);
    await existencias("GALLINA", 5);
    ok(await registrarAjuste(undefined, form({ productoId: gallina.id, tipo: "AJUSTE", sentido: "salida", cantidad: 5, nota: "Murieron" })));
    expect(await stock("GALLINA")).toBe(0);
    const movs = await db.movimientoInventario.findMany({ where: { productoId: aa.id }, orderBy: { id: "asc" } });
    expect(movs.map((m) => [m.tipo, m.cantidad])).toEqual([["AJUSTE", 63], ["ROTURA", -3]]);
  });

  it("valida el ajuste y solo lo hace el administrador", async () => {
    await comoOperacion("ADMIN");
    const aa = await producto("AA");
    fallo(await registrarAjuste(undefined, form({})), /Elige el producto/);
    fallo(await registrarAjuste(undefined, form({ productoId: aa.id, tipo: "VENTA" })), /no válido/);
    fallo(await registrarAjuste(undefined, form({ productoId: aa.id, tipo: "AJUSTE" })), /motivo/);
    fallo(await registrarAjuste(undefined, form({ productoId: aa.id, tipo: "AJUSTE", nota: "x" })), /mayor que cero/);
    await comoOperacion("VENTAS");
    await expect(registrarAjuste(undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});
