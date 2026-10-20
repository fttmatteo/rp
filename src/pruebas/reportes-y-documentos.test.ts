import { describe, expect, it } from "vitest";
import { registrarNovedad } from "@/app/(app)/aves/acciones";
import { cerrarCaja, registrarMovimientoCaja } from "@/app/(app)/caja/acciones";
import { registrarAbono } from "@/app/(app)/cartera/acciones";
import { registrarClasificacion } from "@/app/(app)/clasificacion/acciones";
import { registrarCompra } from "@/app/(app)/egresos/compras";
import { entregarPedido } from "@/app/(app)/pedidos/acciones";
import { registrarSaldoInicialProveedor } from "@/app/(app)/por-pagar/acciones";
import { GET as exportar } from "@/app/(app)/reportes/exportar/route";
import { GET as libro } from "@/app/(app)/reportes/libro/route";
import { GET as reciboPago } from "@/app/recibos/pago/[id]/route";
import { GET as reciboVenta } from "@/app/recibos/venta/[id]/route";
import { db } from "@/lib/db";
import { sumarDias } from "@/lib/formato";
import { diasSinCerrar, libroDelPeriodo, primerMesLibro } from "@/lib/libro-db";
import { generarReporte, REPORTES, type TipoReporte } from "@/lib/reportes";
import { Redireccion } from "@/pruebas/next";
import { ayer, cliente, comoOperacion, deuda, entrarComo, form, hoy, iso, ok, pedido, producto, proveedor, usuario } from "@/pruebas/datos";

const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const peticion = (ruta: string) => new Request(`http://localhost${ruta}`);

/** Un día de trabajo: producción, compra, venta con abono, gasto y novedades de aves. */
async function dia() {
  const admin = await comoOperacion("ADMIN");
  const aa = await producto("AA");
  const rosa = await cliente({ nombre: "Rosa", zona: "Centro", telefono: "3001234567", direccion: "Cra 1" });
  const galpon = await db.galpon.create({ data: { nombre: "G1" } });
  const grupo = await db.grupoAves.create({ data: { galponId: galpon.id, fechaIngreso: sumarDias(hoy(), -30), cantidadInicial: 200 } });
  ok(await registrarClasificacion(undefined, form({ fecha: iso(hoy()), [`cubetas_${aa.id}`]: 5, rotos: 3, grupo: grupo.id })));
  ok(await registrarNovedad(galpon.id, undefined, form({ tipo: "MUERTE", cantidad: 2, fecha: iso(hoy()) })));
  ok(await registrarNovedad(galpon.id, undefined, form({ tipo: "VENTA", cantidad: 8, fecha: iso(hoy()) })));
  const p = await proveedor({ nombre: "Granja" });
  ok(await registrarCompra(undefined, form({ proveedorId: p.id, ingreso: "CLASIFICADA", [`cubetas_${aa.id}`]: 2, total: 30_000, formaPago: "CREDITO" })));
  await deuda(rosa.id, admin.id, 10_000, sumarDias(hoy(), -40));
  const ped = await pedido(rosa.id, [["AA", 2]], { creadoPorId: admin.id });
  ok(await entregarPedido(ped.id, undefined, form({ pagado: 30_000, medio: "EFECTIVO" })));
  ok(await registrarMovimientoCaja(iso(hoy()), undefined, form({ tipo: "EGRESO", gasto: "Gasolina", valor: 5_000, medio: "EFECTIVO" })));
  return { admin, rosa, galpon, grupo, pedido: ped };
}

describe("reportes", () => {
  it("cada reporte resume el período", async () => {
    await dia();
    const r = (tipo: TipoReporte) => generarReporte(tipo, hoy(), hoy(), hoy());

    const clientes = await r("ventas-clientes");
    expect(clientes.filas).toEqual([["Rosa", "Centro", 1, 36_000, 6_000]]);
    expect(clientes.total).toEqual(["Total", null, 1, 36_000, 6_000]);

    expect((await r("ventas-productos")).filas).toEqual([["AA", "cubetas", 2, 36_000]]);

    const produccion = await r("produccion");
    expect(produccion.filas).toEqual([
      ["AA", "cubetas", 5, 2, 7],
      ["Gallina", "gallinas a venta", 8, 0, 8],
    ]);
    expect(produccion.nota).toMatch(/rotos en la clasificación: 3/);

    const galpones = await r("galpones");
    expect(galpones.filas).toHaveLength(1);
    expect(galpones.filas[0].slice(0, 8)).toEqual(["G1", expect.any(String), 200, 2, 0, 8, 0, 190]);
    expect(galpones.filas[0][9]).toBe(153);

    // Rosa debe 6.000 de la venta de hoy y 10.000 de hace 40 días.
    const cartera = await r("cartera");
    expect(cartera.filas).toEqual([["Rosa", "3001234567", 6_000, 0, 10_000, 0, 10_000, 16_000]]);

    // El saldo inicial de un proveedor no es una compra del período.
    const granja = await db.proveedor.findFirstOrThrow({ where: { nombre: "Granja" } });
    ok(await registrarSaldoInicialProveedor(granja.id, undefined, form({ valor: 70_000, fecha: iso(hoy()) })));
    expect((await r("compras")).filas).toEqual([["Granja", 1, 2, 0, 30_000, 30_000]]);
    expect(Object.keys(REPORTES)).toHaveLength(6);
  });

  it("se exportan en Excel y PDF solo con permiso de reportes", async () => {
    await dia();
    const xlsx = await exportar(peticion("/reportes/exportar?tipo=cartera"));
    expect(xlsx.headers.get("Content-Type")).toMatch(/spreadsheetml/);
    expect(xlsx.headers.get("Content-Disposition")).toMatch(/^attachment; filename="cartera_/);
    expect(new Uint8Array(await xlsx.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b])); // zip

    const pdf = await exportar(peticion(`/reportes/exportar?tipo=galpones&desde=${iso(ayer())}&hasta=${iso(hoy())}&formato=pdf`));
    expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe("%PDF-");

    await comoOperacion("REPARTIDOR");
    expect((await exportar(peticion("/reportes/exportar"))).status).toBe(403);
    expect((await libro(peticion("/reportes/libro"))).status).toBe(403);
  });
});

describe("libro mensual", () => {
  it("solo sale con las cajas del período cerradas y arrastra el saldo", async () => {
    const u = await comoOperacion("VENTAS");
    const c = await cliente({ nombre: "Rosa" });
    // Ayer: base 10.000 y un cobro de 5.000, cerrado con 1.000 de faltante.
    await db.caja.create({ data: { dia: ayer(), base: 10_000 } });
    const venta = await deuda(c.id, u.id, 50_000, sumarDias(hoy(), -10));
    await db.consecutivo.create({ data: { nombre: "PAGO", valor: 1 } });
    await db.pago.create({
      data: { consecutivo: 1, clienteId: c.id, usuarioId: u.id, valor: 5_000, medio: "EFECTIVO", dia: ayer(), fecha: sumarDias(new Date(), -1), aplicaciones: { create: [{ ventaId: venta.id, valor: 5_000 }] } },
    });
    expect(await diasSinCerrar(iso(ayer()), iso(hoy()))).toEqual([iso(ayer())]);
    const redirige = await libro(peticion(`/reportes/libro?desde=${iso(ayer())}&hasta=${iso(hoy())}`)).catch((e: Redireccion) => e);
    expect((redirige as Redireccion).url).toMatch(/^\/reportes\?libroDesde=.*#libro$/);

    await db.caja.update({ where: { dia: ayer() }, data: { estado: "CERRADA", esperado: 15_000, contado: 14_000, diferencia: -1_000, observacion: "Billete falso" } });
    // Hoy: un abono por transferencia y un gasto, con la caja cerrada cuadrada.
    ok(await registrarAbono(c.id, undefined, form({ valor: 7_000, medio: "TRANSFERENCIA" })));
    ok(await registrarMovimientoCaja(iso(hoy()), undefined, form({ tipo: "EGRESO", gasto: "Bolsas", valor: 2_000, medio: "EFECTIVO" })));
    ok(await cerrarCaja(iso(hoy()), undefined, form({ contado: 12_000 })));
    expect(await diasSinCerrar(iso(ayer()), iso(hoy()))).toEqual([]);

    const delDia = await libroDelPeriodo(iso(hoy()), iso(hoy()));
    // Saldo de ayer: 10.000 + 5.000 - 1.000.
    expect(delDia.saldoInicial).toBe(14_000);
    expect(delDia.filas.map((f) => [f.concepto, f.ingreso, f.egreso])).toEqual([
      [expect.stringMatching(/^Cobro AB-000002 de Rosa \(RP-000001\) · transferencia$/), 7_000, null],
      ["Bolsas · efectivo", null, 2_000],
    ]);
    expect(delDia.saldoFinal).toBe(19_000);
    const ambos = await libroDelPeriodo(iso(ayer()), iso(hoy()));
    expect(ambos.filas.map((f) => f.concepto)).toContain("Faltante en el cierre de caja: Billete falso");
    expect(await primerMesLibro()).toBe(iso(ayer()).slice(0, 7));

    const xlsx = await libro(peticion(`/reportes/libro?desde=${iso(ayer())}&hasta=${iso(hoy())}`));
    expect(xlsx.headers.get("Content-Disposition")).toBe(`attachment; filename="libro_${iso(ayer())}_${iso(hoy())}.xlsx"`);
    const mes = await libro(peticion(`/reportes/libro?mes=${iso(hoy()).slice(0, 7)}`));
    expect(mes.status).toBe(200);
  });

  it("sin dinero registrado no hay primer mes", async () => {
    expect(await primerMesLibro()).toBeNull();
  });
});

describe("recibos en PDF", () => {
  it("recibo de venta y de pago, con acceso según la operación", async () => {
    const d = await dia();
    const venta = await db.venta.findUniqueOrThrow({ where: { pedidoId: d.pedido.id } });
    const pago = await db.pago.findFirstOrThrow();

    const r = await reciboVenta(peticion(""), params(venta.id));
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(r.headers.get("Content-Disposition")).toBe('inline; filename="RP-000002.pdf"');
    const saldoInicial = await db.venta.findFirstOrThrow({ where: { tipo: "SALDO_INICIAL" } });
    expect((await reciboVenta(peticion(""), params(saldoInicial.id))).status).toBe(200);
    expect((await reciboVenta(peticion(""), params("abc"))).status).toBe(404);
    expect((await reciboPago(peticion(""), params(pago.id))).headers.get("Content-Disposition")).toBe('inline; filename="AB-000001.pdf"');
    expect((await reciboPago(peticion(""), params(999))).status).toBe(404);

    // El repartidor solo ve los recibos de su ruta, y no los de pagos.
    const repartidor = await usuario(["REPARTIDOR"]);
    await entrarComo(repartidor, "REPARTIDOR");
    expect((await reciboVenta(peticion(""), params(venta.id))).status).toBe(403);
    expect((await reciboPago(peticion(""), params(pago.id))).status).toBe(403);
    const ruta = await db.ruta.create({ data: { fecha: hoy(), repartidorId: repartidor.id } });
    await db.pedido.update({ where: { id: d.pedido.id }, data: { rutaId: ruta.id } });
    expect((await reciboVenta(peticion(""), params(venta.id))).status).toBe(200);
  });
});
