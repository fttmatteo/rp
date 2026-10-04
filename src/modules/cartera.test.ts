import { describe, expect, it } from "vitest";
import { aplicarPagoFIFO, rangoAntiguedad, resumenAntiguedad, superaCupo } from "./cartera";

const d = (id: number, saldo: number, fecha: string) => ({ id, saldo, fecha: new Date(fecha) });

describe("aplicarPagoFIFO", () => {
  it("paga primero la deuda más antigua", () => {
    const deudas = [d(2, 30000, "2026-09-20"), d(1, 20000, "2026-09-01")];
    expect(aplicarPagoFIFO(deudas, 25000)).toEqual([
      { ventaId: 1, valor: 20000 },
      { ventaId: 2, valor: 5000 },
    ]);
  });

  it("permite pagar exactamente toda la deuda", () => {
    expect(aplicarPagoFIFO([d(1, 15000, "2026-09-01")], 15000)).toEqual([{ ventaId: 1, valor: 15000 }]);
  });

  it("rechaza pagos mayores que la deuda o no positivos", () => {
    expect(() => aplicarPagoFIFO([d(1, 15000, "2026-09-01")], 15001)).toThrow(/mayor/);
    expect(() => aplicarPagoFIFO([d(1, 15000, "2026-09-01")], 0)).toThrow();
  });
});

describe("antigüedad", () => {
  const hoy = new Date("2026-10-03");
  it("clasifica por días", () => {
    expect(rangoAntiguedad(new Date("2026-09-25"), hoy)).toBe("0-15");
    expect(rangoAntiguedad(new Date("2026-09-10"), hoy)).toBe("16-30");
    expect(rangoAntiguedad(new Date("2026-08-15"), hoy)).toBe("31-60");
    expect(rangoAntiguedad(new Date("2026-06-01"), hoy)).toBe("+60");
  });
  it("suma saldos por rango", () => {
    const r = resumenAntiguedad([d(1, 100, "2026-10-01"), d(2, 50, "2026-06-01")], hoy);
    expect(r).toEqual({ "0-15": 100, "16-30": 0, "31-60": 0, "+60": 50 });
  });
});

describe("superaCupo", () => {
  it("sin cupo nunca supera", () => expect(superaCupo(null, 1e9, 1e9)).toBe(false));
  it("compara saldo + nueva deuda", () => {
    expect(superaCupo(100000, 80000, 20000)).toBe(false);
    expect(superaCupo(100000, 80000, 20001)).toBe(true);
  });
});
