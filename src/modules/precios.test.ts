import { describe, expect, it } from "vitest";
import { precioParaCliente, totalPedido } from "./precios";

describe("precioParaCliente", () => {
  const aa = { productoId: 3, precioGeneral: 18000 };
  it("usa el precio especial del cliente si lo tiene", () => {
    expect(precioParaCliente(aa, new Map([[3, 17000]]))).toBe(17000);
  });
  it("si no, usa el general", () => {
    expect(precioParaCliente(aa, new Map([[4, 13000]]))).toBe(18000);
  });
});

it("totalPedido", () => {
  expect(totalPedido([{ cantidad: 2, precioUnitario: 18000 }, { cantidad: 1, precioUnitario: 22000 }])).toBe(58000);
});
