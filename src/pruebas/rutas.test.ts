import { describe, expect, it } from "vitest";
import { entregarPedido, marcarNoEntregado } from "@/app/(app)/pedidos/acciones";
import {
  abonoEnRuta,
  devolverPrecierre,
  guardarOrden,
  liquidarRuta,
  ordenarRutaPorZona,
  precerrarRuta,
  quitarDeRuta,
  reabrirRuta,
  soltarPedido,
  tomarPedidos,
} from "@/app/(app)/rutas/acciones";
import { db } from "@/lib/db";
import { sumarDias } from "@/lib/formato";
import { datosRuta } from "@/lib/rutas-datos";
import { Redireccion } from "@/pruebas/next";
import { cliente, comoOperacion, deuda, entrarComo, existencias, fallo, form, hoy, ok, pedido, saldo, usuario } from "@/pruebas/datos";

async function escenario() {
  const ventas = await usuario(["VENTAS"]);
  const repartidor = await usuario(["REPARTIDOR"], { nombre: "Johan" });
  const centro = await cliente({ nombre: "Tienda Centro", zona: "Centro", direccion: "Cra 1" });
  const norte = await cliente({ nombre: "Tienda Norte", zona: "Norte", direccion: "Cl 80" });
  const sinZona = await cliente({ nombre: "Sin zona" });
  await existencias("AA", 600);
  const pNorte = await pedido(norte.id, [["AA", 2]], { creadoPorId: ventas.id });
  const pCentro = await pedido(centro.id, [["AA", 1]], { creadoPorId: ventas.id });
  const pSinZona = await pedido(sinZona.id, [["AA", 1]], { creadoPorId: ventas.id });
  return { ventas, repartidor, centro, norte, sinZona, pNorte, pCentro, pSinZona };
}

const orden = async (rutaId: number) => (await db.pedido.findMany({ where: { rutaId }, orderBy: { ordenEnRuta: "asc" } })).map((p) => p.id);

describe("rutas del repartidor", () => {
  it("toma pedidos libres de hoy, ordenados por zona, y otro no puede tomar los mismos", async () => {
    const e = await escenario();
    await entrarComo(e.repartidor, "REPARTIDOR");
    fallo(await tomarPedidos(undefined, form()), /al menos un pedido/);
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id, e.pSinZona.id, e.pCentro.id] })));
    const ruta = await db.ruta.findFirstOrThrow();
    expect(ruta).toMatchObject({ repartidorId: e.repartidor.id, fecha: hoy(), estado: "ABIERTA" });
    expect(await orden(ruta.id)).toEqual([e.pCentro.id, e.pNorte.id, e.pSinZona.id]);

    await comoOperacion("REPARTIDOR");
    fallo(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id] })), /ya lo tomó otro/);
    // De otro día tampoco.
    const otroDia = await pedido(e.norte.id, [["AA", 1]], { creadoPorId: e.ventas.id, fechaEntrega: sumarDias(hoy(), 1) });
    fallo(await tomarPedidos(undefined, form({ pedido: [otroDia.id] })), /ya lo tomó otro/);
  });

  it("los nuevos van al final sin mover los que ya estaban", async () => {
    const e = await escenario();
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pSinZona.id] })));
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id, e.pCentro.id] })));
    const ruta = await db.ruta.findFirstOrThrow();
    expect(await orden(ruta.id)).toEqual([e.pSinZona.id, e.pCentro.id, e.pNorte.id]);
  });

  it("orden por zona y orden a mano", async () => {
    const e = await escenario();
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pSinZona.id] })));
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id, e.pCentro.id] })));
    const ruta = await db.ruta.findFirstOrThrow();
    await entrarComo(e.ventas, "VENTAS");
    ok(await ordenarRutaPorZona(ruta.id, undefined, form()));
    expect(await orden(ruta.id)).toEqual([e.pCentro.id, e.pNorte.id, e.pSinZona.id]);
    ok(await guardarOrden(ruta.id, undefined, form({ [`orden_${e.pSinZona.id}`]: 1, [`orden_${e.pCentro.id}`]: 2, [`orden_${e.pNorte.id}`]: 3 })));
    expect(await orden(ruta.id)).toEqual([e.pSinZona.id, e.pCentro.id, e.pNorte.id]);
  });

  it("soltar y quitar pedidos pendientes", async () => {
    const e = await escenario();
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id, e.pCentro.id] })));
    ok(await soltarPedido(e.pNorte.id, undefined, form()));
    expect((await db.pedido.findUniqueOrThrow({ where: { id: e.pNorte.id } })).rutaId).toBeNull();
    fallo(await soltarPedido(e.pNorte.id, undefined, form()), /no está en una ruta/);

    const otro = await comoOperacion("REPARTIDOR");
    fallo(await soltarPedido(e.pCentro.id, undefined, form()), /no está en tu ruta/);
    void otro;

    await entrarComo(e.ventas, "VENTAS");
    ok(await quitarDeRuta(e.pCentro.id, undefined, form()));
    fallo(await quitarDeRuta(e.pCentro.id, undefined, form()), /no está en una ruta/);
    await expect(soltarPedido(e.pCentro.id, undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });

  it("solo entrega pedidos de su ruta; los sin ruta los entrega ventas", async () => {
    const e = await escenario();
    const otro = await usuario(["REPARTIDOR"]);
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pCentro.id] })));
    fallo(await entregarPedido(e.pNorte.id, undefined, form()), /no está en tu ruta/);
    await entrarComo(otro, "REPARTIDOR");
    fallo(await entregarPedido(e.pCentro.id, undefined, form()), /ruta de otro repartidor/);
    fallo(await marcarNoEntregado(e.pCentro.id, undefined, form({ motivo: "x" })), /ruta de otro repartidor/);
    await entrarComo(e.ventas, "VENTAS");
    ok(await entregarPedido(e.pNorte.id, undefined, form()));
  });

  it("precierre, devolución, liquidación con faltante y reapertura", async () => {
    const e = await escenario();
    const admin = await usuario(["ADMIN"]);
    const vieja = await deuda(e.centro.id, e.ventas.id, 10_000, sumarDias(hoy(), -30));
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id, e.pCentro.id, e.pSinZona.id] })));
    const ruta = await db.ruta.findFirstOrThrow();

    // Norte paga 20.000 en efectivo de 36.000; Centro paga por transferencia y abona 4.000 a su deuda.
    ok(await entregarPedido(e.pNorte.id, undefined, form({ pagado: 20_000, medio: "EFECTIVO" })));
    ok(await entregarPedido(e.pCentro.id, undefined, form({ pagado: 18_000, medio: "TRANSFERENCIA" })));
    ok(await abonoEnRuta(ruta.id, e.centro.id, undefined, form({ valor: 4_000, medio: "EFECTIVO" })));
    expect(await saldo(vieja.id)).toBe(6_000);

    // Le falta un pedido por entregar.
    fallo(await precerrarRuta(ruta.id, undefined, form({ entregado: 24_000 })), /Te quedan 1 pedidos/);
    ok(await marcarNoEntregado(e.pSinZona.id, undefined, form({ motivo: "Cerrado" })));
    fallo(await precerrarRuta(ruta.id, undefined, form()), /efectivo que entregas/);
    fallo(await precerrarRuta(ruta.id, undefined, form({ entregado: 23_000 })), /diferencia/);
    ok(await precerrarRuta(ruta.id, undefined, form({ entregado: 23_000, observacion: "Se me cayó un billete" })));
    expect(await db.ruta.findUniqueOrThrow({ where: { id: ruta.id } })).toMatchObject({
      estado: "PRECERRADA",
      efectivoEsperado: 24_000,
      efectivoEntregado: 23_000,
      diferencia: -1_000,
    });
    // Con precierre no entra nada más.
    fallo(await abonoEnRuta(ruta.id, e.centro.id, undefined, form({ valor: 1, medio: "EFECTIVO" })), /ya tiene precierre/);
    fallo(await precerrarRuta(ruta.id, undefined, form({ entregado: 1 })), /ya tiene precierre/);

    // Solo el administrador aprueba.
    await expect(liquidarRuta(ruta.id, undefined, form({ entregado: 1 }))).rejects.toEqual(new Redireccion("/sin-acceso"));
    await entrarComo(admin, "ADMIN");
    ok(await devolverPrecierre(ruta.id, undefined, form()));
    fallo(await devolverPrecierre(ruta.id, undefined, form()), /no tiene precierre/);
    expect((await db.ruta.findUniqueOrThrow({ where: { id: ruta.id } })).estado).toBe("ABIERTA");

    // El resumen de la ruta cuadra con lo cobrado.
    const datos = (await datosRuta(ruta.id))!;
    expect(datos.liquidacion).toMatchObject({ cobradoEfectivo: 24_000, cobradoTransferencia: 18_000, abonosEfectivo: 4_000, efectivoEsperado: 24_000 });
    expect(datos.cierre).toMatchObject({ entregados: 2, noEntregados: 1, valorEntregado: 54_000, pagado: 38_000, pendiente: 16_000 });
    expect(await datosRuta(999)).toBeNull();

    fallo(await liquidarRuta(ruta.id, undefined, form()), /efectivo que entregó/);
    ok(await liquidarRuta(ruta.id, undefined, form({ entregado: 23_000, observacion: "Faltó" })));
    const liquidada = await db.ruta.findUniqueOrThrow({ where: { id: ruta.id } });
    expect(liquidada).toMatchObject({ estado: "LIQUIDADA", diferencia: -1_000, liquidadaPorId: admin.id });
    // El faltante queda como gasto en la caja de hoy para que cuadre.
    const faltante = await db.movimientoCaja.findFirstOrThrow({ where: { rutaId: ruta.id } });
    expect(faltante).toMatchObject({ tipo: "EGRESO", valor: 1_000, medio: "EFECTIVO", anulado: false });
    expect(faltante.concepto).toMatch(/^Faltante en la liquidación de la ruta de Johan/);
    fallo(await liquidarRuta(ruta.id, undefined, form({ entregado: 23_000, observacion: "x" })), /ya se liquidó/);

    // Reabrir anula el faltante.
    fallo(await reabrirRuta(999, undefined, form()), /no encontrada/);
    ok(await reabrirRuta(ruta.id, undefined, form()));
    expect((await db.movimientoCaja.findUniqueOrThrow({ where: { id: faltante.id } })).anulado).toBe(true);
    expect(await db.ruta.findUniqueOrThrow({ where: { id: ruta.id } })).toMatchObject({ estado: "ABIERTA", diferencia: null });
    fallo(await reabrirRuta(ruta.id, undefined, form()), /no está liquidada/);
  });

  it("liquidar sin precierre deja como no entregado lo pendiente y registra el sobrante", async () => {
    const e = await escenario();
    const admin = await usuario(["ADMIN"]);
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id] })));
    const ruta = await db.ruta.findFirstOrThrow();
    await entrarComo(admin, "ADMIN");
    ok(await liquidarRuta(ruta.id, undefined, form({ entregado: 500, observacion: "Sobró" })));
    expect(await db.pedido.findUniqueOrThrow({ where: { id: e.pNorte.id } })).toMatchObject({
      estado: "NO_ENTREGADO",
      motivoNoEntrega: "Sin entregar al liquidar la ruta",
    });
    expect(await db.movimientoCaja.findFirstOrThrow()).toMatchObject({ tipo: "INGRESO", valor: 500 });
    // Con la ruta liquidada no se entrega ni se cobra.
    await entrarComo(e.repartidor, "REPARTIDOR");
    fallo(await abonoEnRuta(ruta.id, e.norte.id, undefined, form({ valor: 1, medio: "EFECTIVO" })), /ya se liquidó/);
    fallo(await precerrarRuta(ruta.id, undefined, form({ entregado: 0 })), /ya se liquidó/);
  });

  it("cuadrada no deja movimiento en caja; otro repartidor no la precierra ni cobra en ella", async () => {
    const e = await escenario();
    const otro = await usuario(["REPARTIDOR"]);
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await tomarPedidos(undefined, form({ pedido: [e.pNorte.id] })));
    const ruta = await db.ruta.findFirstOrThrow();
    await entrarComo(otro, "REPARTIDOR");
    fallo(await precerrarRuta(ruta.id, undefined, form({ entregado: 0 })), /no es tu ruta/);
    fallo(await abonoEnRuta(ruta.id, e.norte.id, undefined, form({ valor: 1, medio: "EFECTIVO" })), /no es tu ruta/);
    await entrarComo(e.repartidor, "REPARTIDOR");
    ok(await entregarPedido(e.pNorte.id, undefined, form()));
    ok(await precerrarRuta(ruta.id, undefined, form({ entregado: 0 })));
    await comoOperacion("ADMIN");
    ok(await liquidarRuta(ruta.id, undefined, form({ entregado: 0 })));
    expect(await db.movimientoCaja.count()).toBe(0);
  });
});
