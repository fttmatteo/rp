import { describe, expect, it } from "vitest";
import { conceptoGasto, OTRO_GASTO } from "./gastos";

describe("conceptoGasto", () => {
  it("usa el concepto de la lista e ignora lo escrito", () => {
    expect(conceptoGasto("Gasolina", "algo")).toBe("Gasolina");
  });
  it("con Otro usa lo escrito", () => {
    expect(conceptoGasto(OTRO_GASTO, "  Préstamo  ")).toBe("Préstamo");
    expect(conceptoGasto(OTRO_GASTO, " ")).toBeNull();
  });
  it("rechaza lo que no está en la lista", () => {
    expect(conceptoGasto("Inventado", "")).toBeNull();
    expect(conceptoGasto("", "")).toBeNull();
  });
});
