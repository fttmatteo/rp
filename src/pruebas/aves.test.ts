import { describe, expect, it } from "vitest";
import { actualizarGalpon, anularNovedad, crearGalpon, entradaAves, registrarNovedad } from "@/app/(app)/aves/acciones";
import { avesPorGrupo, huevosPorGrupoYDia } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { Redireccion } from "@/pruebas/next";
import { comoOperacion, fallo, form, hoy, iso, ok, producto, stock } from "@/pruebas/datos";

const entrada = (cantidad: number) => ({ cantidadInicial: cantidad, fechaIngreso: iso(hoy()), edadIngresoSemanas: 18, etapa: "POSTURA", raza: "Lohmann" });

async function galpon(nombre: string, aves = 0) {
  const r = await crearGalpon(undefined, form({ nombre, capacidad: 1_000, ...(aves ? entrada(aves) : {}) })).catch((e: Redireccion) => e);
  expect(r).toBeInstanceOf(Redireccion);
  return db.galpon.findUniqueOrThrow({ where: { nombre } });
}

const vivas = async (galponId: number) => {
  const g = await db.grupoAves.findFirst({ where: { galponId, activo: true } });
  return g ? (await avesPorGrupo([g])).get(g.id) : 0;
};

describe("galpones y aves", () => {
  it("crea galpones, vacíos o con aves, y registra la entrada en uno vacío", async () => {
    await comoOperacion("ADMIN");
    const g1 = await galpon("Galpón 1", 500);
    expect(await vivas(g1.id)).toBe(500);
    const g2 = await galpon("Galpón 2");
    expect(await vivas(g2.id)).toBe(0);
    fallo(await crearGalpon(undefined, form({ nombre: "" })), /nombre del galpón/);
    fallo(await crearGalpon(undefined, form({ nombre: "Galpón 1" })), /Ya existe/);

    fallo(await entradaAves(g2.id, undefined, form({})), /cuántas aves/);
    fallo(await entradaAves(g2.id, undefined, form({ ...entrada(10), etapa: "OTRA" })), /etapa/);
    fallo(await entradaAves(g2.id, undefined, form({ ...entrada(10), fechaIngreso: "2999-01-01" })), /Fecha/);
    ok(await entradaAves(g2.id, undefined, form(entrada(300))));
    fallo(await entradaAves(g2.id, undefined, form(entrada(1))), /ya tiene aves/);
    fallo(await entradaAves(999, undefined, form(entrada(1))), /no está en uso/);
  });

  it("muertes, paso a venta y traslado; el galpón queda vacío cuando salen todas", async () => {
    await comoOperacion("ADMIN");
    const g1 = await galpon("G1", 100);
    const g2 = await galpon("G2");
    const f = iso(hoy());
    ok(await registrarNovedad(g1.id, undefined, form({ tipo: "MUERTE", cantidad: 3, fecha: f })));
    expect(ok(await registrarNovedad(g1.id, undefined, form({ tipo: "VENTA", cantidad: 7, fecha: f })))).toMatch(/inventario para vender/);
    expect(await stock("GALLINA")).toBe(7);
    fallo(await registrarNovedad(g1.id, undefined, form({ tipo: "DESCARTE", cantidad: 91, fecha: f })), /solo tiene 90 aves/);
    fallo(await registrarNovedad(g1.id, undefined, form({ tipo: "TRASLADO", cantidad: 1, fecha: f })), /galpón al que pasan/);

    // El traslado a un galpón vacío crea su grupo con la etapa que traen.
    ok(await registrarNovedad(g1.id, undefined, form({ tipo: "TRASLADO", cantidad: 40, fecha: f, galponDestinoId: g2.id })));
    expect(await vivas(g1.id)).toBe(50);
    expect(await vivas(g2.id)).toBe(40);
    expect((await db.grupoAves.findFirstOrThrow({ where: { galponId: g2.id } })).etapa).toBe("POSTURA");

    expect(ok(await registrarNovedad(g1.id, undefined, form({ tipo: "DESCARTE", cantidad: 50, fecha: f })))).toMatch(/quedó vacío/);
    expect(await vivas(g1.id)).toBe(0);
    fallo(await registrarNovedad(g1.id, undefined, form({ tipo: "MUERTE", cantidad: 1, fecha: f })), /no tiene aves/);
    fallo(await registrarNovedad(g1.id, undefined, form({ tipo: "OTRA" })), /Elige qué pasó/);
    fallo(await registrarNovedad(g1.id, undefined, form({ tipo: "MUERTE", cantidad: 0 })), /mayor que cero/);
  });

  it("anular novedades devuelve las aves al galpón de origen", async () => {
    await comoOperacion("ADMIN");
    const g1 = await galpon("G1", 10);
    const g2 = await galpon("G2");
    const f = iso(hoy());
    ok(await registrarNovedad(g1.id, undefined, form({ tipo: "VENTA", cantidad: 4, fecha: f })));
    ok(await registrarNovedad(g1.id, undefined, form({ tipo: "TRASLADO", cantidad: 6, fecha: f, galponDestinoId: g2.id })));
    expect(await vivas(g1.id)).toBe(0);
    const [venta, traslado] = await db.novedadAves.findMany({ orderBy: { id: "asc" } });

    ok(await anularNovedad(traslado.id, undefined, form()));
    expect(await vivas(g1.id)).toBe(6);
    expect(await vivas(g2.id)).toBe(0);
    fallo(await anularNovedad(traslado.id, undefined, form()), /ya estaba anulada/);

    // Las gallinas pasadas a venta solo se devuelven si no se vendieron.
    const gallina = await producto("GALLINA");
    await db.producto.update({ where: { id: gallina.id }, data: { existencias: 3 } });
    fallo(await anularNovedad(venta.id, undefined, form()), /ya se vendieron/);
    await db.producto.update({ where: { id: gallina.id }, data: { existencias: 4 } });
    ok(await anularNovedad(venta.id, undefined, form()));
    expect(await stock("GALLINA")).toBe(0);
    expect(await vivas(g1.id)).toBe(10);
    fallo(await anularNovedad(999, undefined, form()), /no encontrada/);
  });

  it("no anula si el destino ya no tiene las aves o el origen tiene aves nuevas", async () => {
    await comoOperacion("ADMIN");
    const g1 = await galpon("G1", 10);
    const g2 = await galpon("G2");
    const f = iso(hoy());
    ok(await registrarNovedad(g1.id, undefined, form({ tipo: "TRASLADO", cantidad: 10, fecha: f, galponDestinoId: g2.id })));
    ok(await registrarNovedad(g2.id, undefined, form({ tipo: "MUERTE", cantidad: 1, fecha: f })));
    const traslado = await db.novedadAves.findFirstOrThrow({ where: { tipo: "TRASLADO" } });
    fallo(await anularNovedad(traslado.id, undefined, form()), /destino ya no tiene esas aves/);
    ok(await entradaAves(g1.id, undefined, form(entrada(5))));
    fallo(await anularNovedad(traslado.id, undefined, form()), /ya tiene aves nuevas/);
  });

  it("actualiza el galpón y solo deja fuera de uso uno vacío", async () => {
    await comoOperacion("ADMIN");
    const g1 = await galpon("G1", 10);
    ok(await actualizarGalpon(g1.id, undefined, form({ nombre: "Galpón Norte", capacidad: 800, etapa: "DESCARTE", nota: "Viejas" })));
    expect(await db.grupoAves.findFirstOrThrow({ where: { galponId: g1.id } })).toMatchObject({ etapa: "DESCARTE", nota: "Viejas" });
    fallo(await actualizarGalpon(g1.id, undefined, form({ nombre: "G", fueraDeUso: true, etapa: "POSTURA" })), /galpón vacío/);
    fallo(await actualizarGalpon(g1.id, undefined, form({ nombre: "" })), /nombre/);
    const g2 = await galpon("G2");
    ok(await actualizarGalpon(g2.id, undefined, form({ nombre: "G2", fueraDeUso: true })));
    expect((await db.galpon.findUniqueOrThrow({ where: { id: g2.id } })).activo).toBe(false);
    fallo(await registrarNovedad(g1.id, undefined, form({ tipo: "TRASLADO", cantidad: 1, fecha: iso(hoy()), galponDestinoId: g2.id })), /destino no está en uso/);
  });

  it("huevos por galpón y día, sin registros anulados", async () => {
    const u = await comoOperacion("ADMIN");
    const g1 = await galpon("G1", 100);
    const grupo = await db.grupoAves.findFirstOrThrow();
    const aa = await producto("AA");
    await db.registroClasificacion.create({
      data: { fecha: hoy(), usuarioId: u.id, rotos: 5, grupoId: grupo.id, detalles: { create: [{ productoId: aa.id, cantidad: 60 }] } },
    });
    expect(await huevosPorGrupoYDia([grupo.id], hoy(), hoy())).toEqual(new Map([[`${grupo.id}|${iso(hoy())}`, 65]]));
    void g1;
  });

  it("ventas no maneja aves", async () => {
    await comoOperacion("VENTAS");
    await expect(crearGalpon(undefined, form())).rejects.toEqual(new Redireccion("/sin-acceso"));
  });
});
