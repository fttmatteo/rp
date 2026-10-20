import { describe, expect, it } from "vitest";
import { lineasReciboVenta } from "./recibos";

const aa = { tipo: "CUBETA", nombre: "AA" };
const gallina = { tipo: "GALLINA", nombre: "Gallina" };

describe("líneas del recibo de venta", () => {
  it("entrega completa: lo pedido", () => {
    expect(lineasReciboVenta([{ cantidad: 2, cantidadEntregada: 2, precioUnitario: 18_000, producto: aa }], { total: 36_000, nota: null })).toEqual([
      { descripcion: "Cubeta x30 AA", cantidad: 2, precio: 18_000, valor: 36_000 },
    ]);
  });

  it("entrega parcial: solo lo entregado, y suma el total de la venta", () => {
    const lineas = lineasReciboVenta(
      [
        { cantidad: 3, cantidadEntregada: 1, precioUnitario: 18_000, producto: aa },
        { cantidad: 2, cantidadEntregada: 0, precioUnitario: 25_000, producto: gallina },
      ],
      { total: 18_000, nota: null },
    );
    expect(lineas).toEqual([{ descripcion: "Cubeta x30 AA", cantidad: 1, precio: 18_000, valor: 18_000 }]);
  });

  it("sin cantidad entregada guardada usa lo pedido", () => {
    expect(lineasReciboVenta([{ cantidad: 4, cantidadEntregada: null, precioUnitario: 20_000, producto: gallina }], { total: 80_000, nota: null })[0]).toMatchObject({
      descripcion: "Gallina",
      cantidad: 4,
      valor: 80_000,
    });
  });

  it("saldo inicial, con y sin nota", () => {
    expect(lineasReciboVenta(null, { total: 50_000, nota: "cuaderno" })).toEqual([{ descripcion: "Saldo inicial: cuaderno", valor: 50_000 }]);
    expect(lineasReciboVenta(null, { total: 50_000, nota: null })).toEqual([{ descripcion: "Saldo inicial", valor: 50_000 }]);
  });
});
