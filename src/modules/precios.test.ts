import { describe, expect, it } from "vitest";
import { precioParaCliente, totalPedido, valorAGuardar } from "./precios";

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

describe("valorAGuardar", () => {
  it("sin el valor con que se abrió la página, guarda lo escrito", () => {
    expect(valorAGuardar(19000, undefined, 18000)).toEqual({ valor: 19000, choque: false });
  });
  it("lo que la persona no tocó conserva el cambio de otra persona", () => {
    expect(valorAGuardar(18000, 18000, 20000)).toEqual({ valor: 20000, choque: false });
  });
  it("lo que tocó se guarda si nadie más lo cambió", () => {
    expect(valorAGuardar(19000, 18000, 18000)).toEqual({ valor: 19000, choque: false });
  });
  it("si los dos escribieron lo mismo no hay choque", () => {
    expect(valorAGuardar(19000, 18000, 19000)).toEqual({ valor: 19000, choque: false });
  });
  it("si otra persona lo cambió a otro valor, es un choque", () => {
    expect(valorAGuardar<number | null>(19000, 18000, 20000).choque).toBe(true);
    expect(valorAGuardar<number | null>(null, 18000, 20000).choque).toBe(true);
  });
});
