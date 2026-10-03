import { describe, expect, it } from "vitest";
import { faltantes, huevosDe, unidadesInventario } from "./inventario";
import { formatoHuevos } from "@/lib/formato";

describe("inventario", () => {
  it("las cubetas se descuentan en huevos y las gallinas por unidad", () => {
    expect(unidadesInventario("CUBETA", 3)).toBe(90);
    expect(unidadesInventario("GALLINA", 3)).toBe(3);
    expect(huevosDe(2, 5)).toBe(65);
  });
  it("muestra cubetas y huevos sueltos", () => {
    expect(formatoHuevos(65)).toBe("2 cubetas + 5 huevos");
    expect(formatoHuevos(30)).toBe("1 cubeta");
    expect(formatoHuevos(-31)).toBe("-1 cubeta + 1 huevo");
  });
  it("detecta faltantes sumando líneas del mismo producto", () => {
    const stock = new Map([[1, 60]]);
    expect(faltantes([{ productoId: 1, unidades: 30 }, { productoId: 1, unidades: 30 }], stock)).toEqual([]);
    expect(faltantes([{ productoId: 1, unidades: 90 }, { productoId: 2, unidades: 1 }], stock)).toEqual([
      { productoId: 1, disponible: 60, requerido: 90 },
      { productoId: 2, disponible: 0, requerido: 1 },
    ]);
  });
});
