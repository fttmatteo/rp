import { describe, expect, it } from "vitest";
import { avesVivas, bajasPorTipo, edadSemanas, porcentajePostura, type Novedad } from "./aves";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const n = (p: Partial<Novedad>): Novedad => ({
  loteId: 1,
  loteDestinoId: null,
  tipo: "MUERTE",
  cantidad: 1,
  fecha: d("2026-10-01"),
  anulada: false,
  ...p,
});

describe("aves", () => {
  const novedades = [
    n({ tipo: "MUERTE", cantidad: 5 }),
    n({ tipo: "VENTA", cantidad: 20, fecha: d("2026-10-03") }),
    n({ tipo: "TRASLADO", cantidad: 100, loteDestinoId: 2 }),
    n({ tipo: "DESCARTE", cantidad: 7, anulada: true }),
  ];
  it("cuenta las aves vivas con traslados de entrada y salida", () => {
    expect(avesVivas({ id: 1, cantidadInicial: 1000 }, novedades)).toBe(875);
    expect(avesVivas({ id: 2, cantidadInicial: 500 }, novedades)).toBe(600);
    expect(avesVivas({ id: 1, cantidadInicial: 1000 }, novedades, d("2026-10-02"))).toBe(895);
  });
  it("calcula edad y postura", () => {
    expect(edadSemanas(d("2026-09-01"), 18, d("2026-10-05"))).toBe(22);
    expect(porcentajePostura(850, 1000)).toBe(85);
    expect(porcentajePostura(10, 0)).toBeNull();
  });
  it("suma bajas sin contar traslados ni anuladas", () => {
    expect(bajasPorTipo(novedades)).toEqual({ MUERTE: 5, DESCARTE: 0, VENTA: 20 });
  });
});
