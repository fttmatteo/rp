import { describe, expect, it } from "vitest";
import { efectivoEsperado, quincena, totalTransferencias, validarCierre } from "./caja";

const t = {
  base: 50000,
  cobrosEfectivo: 120000,
  cobrosTransferencia: 40000,
  ingresosEfectivo: 10000,
  ingresosTransferencia: 0,
  egresosEfectivo: 30000,
  egresosTransferencia: 5000,
};

describe("caja", () => {
  it("el esperado solo cuenta efectivo", () => {
    expect(efectivoEsperado(t)).toBe(150000);
    expect(totalTransferencias(t)).toBe(35000);
  });
  it("cierre cuadrado no pide observación", () => {
    expect(validarCierre(150000, 150000, null)).toBe(0);
  });
  it("con diferencia exige observación", () => {
    expect(() => validarCierre(150000, 148000, null)).toThrow(/diferencia/);
    expect(validarCierre(150000, 148000, "faltó cambio")).toBe(-2000);
  });
  it("quincenas", () => {
    expect(quincena("2026-10-04")).toEqual({ desde: "2026-10-01", hasta: "2026-10-15" });
    expect(quincena("2026-02-20")).toEqual({ desde: "2026-02-16", hasta: "2026-02-28" });
    expect(quincena("2026-10-31")).toEqual({ desde: "2026-10-16", hasta: "2026-10-31" });
  });
});
