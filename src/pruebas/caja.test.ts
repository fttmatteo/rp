import { describe, expect, it } from "vitest";
import {
  actualizarBase,
  anularMovimientoCaja,
  cerrarCaja,
  reabrirCaja,
  registrarMovimientoCaja,
  verificarTransferencia,
} from "@/app/(app)/caja/acciones";
import { obtenerCaja, totalesCaja, totalesCajaRango } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { efectivoEsperado } from "@/modules/caja";
import { Redireccion } from "@/pruebas/next";
import { ayer, cliente, comoOperacion, fallo, form, hoy, iso, ok } from "@/pruebas/datos";

const hoyISO = () => iso(hoy());

async function cobro(clienteId: number, usuarioId: number, valor: number, medio: "EFECTIVO" | "TRANSFERENCIA", dia = hoy()) {
  return db.pago.create({ data: { consecutivo: Math.floor(Math.random() * 1e9), clienteId, usuarioId, valor, medio, dia } });
}

describe("caja diaria", () => {
  it("la caja nueva arranca con el efectivo contado en el último cierre", async () => {
    const u = await comoOperacion("VENTAS");
    await db.caja.create({ data: { dia: ayer(), estado: "CERRADA", base: 0, contado: 87_000, cerradaPorId: u.id } });
    // Sin crear: se calcula pero no se guarda.
    expect((await obtenerCaja(hoy(), db, false)).base).toBe(87_000);
    expect(await db.caja.count()).toBe(1);
    expect((await obtenerCaja(hoy())).base).toBe(87_000);
    expect(await db.caja.count()).toBe(2);
  });

  it("cuadra el esperado con cobros, ingresos y gastos en efectivo", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    ok(await actualizarBase(hoyISO(), undefined, form({ base: "50.000" })));
    await cobro(c.id, u.id, 120_000, "EFECTIVO");
    await cobro(c.id, u.id, 40_000, "TRANSFERENCIA");
    ok(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "INGRESO", concepto: "Venta de cartón", valor: 10_000, medio: "EFECTIVO" })));
    ok(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "EGRESO", gasto: "Gasolina", valor: 30_000, medio: "EFECTIVO" })));
    ok(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "EGRESO", gasto: "OTRO", concepto: "Arreglo", valor: 5_000, medio: "TRANSFERENCIA" })));

    const t = await totalesCaja(hoy(), 50_000);
    expect(t).toEqual({
      base: 50_000,
      cobrosEfectivo: 120_000,
      cobrosTransferencia: 40_000,
      ingresosEfectivo: 10_000,
      ingresosTransferencia: 0,
      egresosEfectivo: 30_000,
      egresosTransferencia: 5_000,
    });
    expect(efectivoEsperado(t)).toBe(150_000);
    const conceptos = (await db.movimientoCaja.findMany({ orderBy: { id: "asc" } })).map((m) => m.concepto);
    expect(conceptos).toEqual(["Venta de cartón", "Gasolina", "Arreglo"]);

    // Cierre cuadrado.
    ok(await cerrarCaja(hoyISO(), undefined, form({ contado: 150_000 })));
    const caja = await db.caja.findUniqueOrThrow({ where: { dia: hoy() } });
    expect(caja).toMatchObject({ estado: "CERRADA", esperado: 150_000, contado: 150_000, diferencia: 0, cerradaPorId: u.id });
  });

  it("totales por rango agrupan cada día por separado", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    await cobro(c.id, u.id, 1_000, "EFECTIVO", ayer());
    await cobro(c.id, u.id, 2_000, "EFECTIVO");
    const rango = await totalesCajaRango(ayer(), hoy());
    expect(rango.get(ayer().getTime())!(0).cobrosEfectivo).toBe(1_000);
    expect(rango.get(hoy().getTime())!(10).cobrosEfectivo).toBe(2_000);
    expect((await totalesCaja(new Date("2000-01-01"), 5)).base).toBe(5);
  });

  it("no deja sacar en efectivo más de lo que hay en caja", async () => {
    await comoOperacion("VENTAS");
    ok(await actualizarBase(hoyISO(), undefined, form({ base: 20_000 })));
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "EGRESO", gasto: "Gasolina", valor: 20_001, medio: "EFECTIVO" })), /No hay tanto efectivo/);
    // Por transferencia sí.
    ok(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "EGRESO", gasto: "Gasolina", valor: 50_000, medio: "TRANSFERENCIA" })));
  });

  it("valida los datos del movimiento", async () => {
    await comoOperacion("VENTAS");
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "OTRO" })), /ingreso o gasto/);
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "EGRESO", gasto: "", valor: 1 })), /Elige el gasto/);
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "INGRESO", valor: 1 })), /concepto/);
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "INGRESO", concepto: "x", valor: 0 })), /mayor que cero/);
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "INGRESO", concepto: "x", valor: 5 })), /medio de pago/);
    fallo(await registrarMovimientoCaja("2999-01-01", undefined, form({ tipo: "INGRESO", concepto: "x", valor: 5, medio: "EFECTIVO" })), /Día no válido/);
    fallo(await actualizarBase(hoyISO(), undefined, form({})), /Escribe la base/);
    fallo(await cerrarCaja(hoyISO(), undefined, form({})), /efectivo contado/);
  });

  it("con diferencia exige observación y la guarda en el cierre", async () => {
    await comoOperacion("VENTAS");
    ok(await actualizarBase(hoyISO(), undefined, form({ base: 10_000 })));
    fallo(await cerrarCaja(hoyISO(), undefined, form({ contado: 9_000 })), /diferencia/);
    ok(await cerrarCaja(hoyISO(), undefined, form({ contado: 9_000, observacion: "Faltó el cambio" })));
    expect(await db.caja.findUniqueOrThrow({ where: { dia: hoy() } })).toMatchObject({ diferencia: -1_000, observacion: "Faltó el cambio" });
  });

  it("con la caja cerrada no entra ni sale dinero hasta que el administrador la reabre", async () => {
    await comoOperacion("VENTAS");
    ok(await cerrarCaja(hoyISO(), undefined, form({ contado: 0 })));
    fallo(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "INGRESO", concepto: "x", valor: 5, medio: "EFECTIVO" })), /ya está cerrada/);
    fallo(await actualizarBase(hoyISO(), undefined, form({ base: 1 })), /ya está cerrada/);
    fallo(await cerrarCaja(hoyISO(), undefined, form({ contado: 0 })), /ya está cerrada/);

    // Ventas no puede reabrir.
    await expect(reabrirCaja(hoyISO(), undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));

    const admin = await comoOperacion("ADMIN");
    ok(await reabrirCaja(hoyISO(), undefined, form()));
    expect(await db.caja.findUniqueOrThrow({ where: { dia: hoy() } })).toMatchObject({ estado: "ABIERTA", contado: null, cerradaPorId: null });
    const auditoria = await db.auditoria.findFirstOrThrow({ where: { entidad: "Caja", accion: "reabrir" } });
    expect(auditoria).toMatchObject({ usuarioId: admin.id, detalle: { contado: 0, diferencia: 0 } });
    fallo(await reabrirCaja(hoyISO(), undefined, form()), /no está cerrada/);
  });

  it("anula movimientos propios de la caja pero no los de rutas o proveedores", async () => {
    const u = await comoOperacion("VENTAS");
    ok(await registrarMovimientoCaja(hoyISO(), undefined, form({ tipo: "INGRESO", concepto: "x", valor: 5, medio: "EFECTIVO" })));
    const mov = await db.movimientoCaja.findFirstOrThrow();
    ok(await anularMovimientoCaja(mov.id, undefined, form()));
    expect((await db.movimientoCaja.findUniqueOrThrow({ where: { id: mov.id } })).anulado).toBe(true);
    fallo(await anularMovimientoCaja(mov.id, undefined, form()), /ya estaba anulado/);
    fallo(await anularMovimientoCaja(999, undefined, form()), /no encontrado/);

    const ruta = await db.ruta.create({ data: { fecha: hoy(), repartidorId: u.id } });
    const deRuta = await db.movimientoCaja.create({ data: { dia: hoy(), tipo: "EGRESO", concepto: "Faltante", valor: 1, medio: "EFECTIVO", usuarioId: u.id, rutaId: ruta.id } });
    fallo(await anularMovimientoCaja(deRuta.id, undefined, form()), /liquidación de una ruta/);
    const p = await db.proveedor.create({ data: { nombre: "P" } });
    const compra = await db.compra.create({
      data: { proveedorId: p.id, dia: hoy(), usuarioId: u.id, clasificada: true, huevos: 30, total: 1, saldo: 0, formaPago: "CONTADO" },
    });
    const deCompra = await db.movimientoCaja.create({ data: { dia: hoy(), tipo: "EGRESO", concepto: "Compra", valor: 1, medio: "EFECTIVO", usuarioId: u.id, compraId: compra.id } });
    fallo(await anularMovimientoCaja(deCompra.id, undefined, form()), /proveedor/);
  });

  it("marca y desmarca transferencias aunque la caja esté cerrada", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente();
    const pago = await cobro(c.id, u.id, 40_000, "TRANSFERENCIA");
    const efectivo = await cobro(c.id, u.id, 1_000, "EFECTIVO");
    ok(await cerrarCaja(hoyISO(), undefined, form({ contado: 1_000 })));
    ok(await verificarTransferencia("Pago", pago.id, true, undefined, form()));
    expect((await db.pago.findUniqueOrThrow({ where: { id: pago.id } })).verificadoEn).not.toBeNull();
    ok(await verificarTransferencia("Pago", pago.id, false, undefined, form()));
    expect((await db.pago.findUniqueOrThrow({ where: { id: pago.id } })).verificadoEn).toBeNull();
    fallo(await verificarTransferencia("Pago", efectivo.id, true, undefined, form()), /no encontrada/);

    const mov = await db.movimientoCaja.create({ data: { dia: hoy(), tipo: "INGRESO", concepto: "x", valor: 1, medio: "TRANSFERENCIA", usuarioId: u.id } });
    ok(await verificarTransferencia("MovimientoCaja", mov.id, true, undefined, form()));
  });

  it("el repartidor no entra a la caja y sin sesión se va al login", async () => {
    await expect(cerrarCaja(hoyISO(), undefined, form({ contado: 0 }))).rejects.toEqual(new Redireccion("/login"));
    await comoOperacion("REPARTIDOR");
    await expect(cerrarCaja(hoyISO(), undefined, form({ contado: 0 }))).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});
