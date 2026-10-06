import { describe, expect, it } from "vitest";
import { armarLibro, leerMes, mesesEntre, nombreMes, rangoMes } from "./libro";

describe("libro mensual", () => {
  it("ordena por día y hora y acumula el saldo desde el saldo inicial", () => {
    const libro = armarLibro(100_000, [
      { dia: "2026-09-02", momento: 5, concepto: "Gasto", ingreso: 0, egreso: 30_000 },
      { dia: "2026-09-01", momento: 9, concepto: "Cobro", ingreso: 50_000, egreso: 0 },
      { dia: "2026-09-02", momento: 1, concepto: "Cobro 2", ingreso: 20_000, egreso: 0 },
    ]);
    expect(libro.filas.map((f) => [f.fecha, f.concepto, f.ingreso, f.egreso, f.saldo])).toEqual([
      ["2026-09-01", "Cobro", 50_000, null, 150_000],
      ["2026-09-02", "Cobro 2", 20_000, null, 170_000],
      ["2026-09-02", "Gasto", null, 30_000, 140_000],
    ]);
    expect(libro).toMatchObject({ saldoInicial: 100_000, ingresos: 70_000, egresos: 30_000, saldoFinal: 140_000 });
  });

  it("sin movimientos el saldo final es el inicial", () => {
    expect(armarLibro(5_000, [])).toEqual({ saldoInicial: 5_000, filas: [], ingresos: 0, egresos: 0, saldoFinal: 5_000 });
  });

  it("lee y recorre meses", () => {
    expect(leerMes("2026-09")).toBe("2026-09");
    expect(leerMes("2026-13")).toBeNull();
    expect(leerMes("x")).toBeNull();
    expect(rangoMes("2028-02")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(mesesEntre("2025-11", "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
    expect(nombreMes("2026-09")).toBe("septiembre de 2026");
  });
});
