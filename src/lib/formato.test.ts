import { describe, expect, it } from "vitest";
import { formatoCantidad, nombreProducto } from "./formato";

describe("formato de productos", () => {
  it("muestra la gallinaza en su unidad", () => {
    expect(formatoCantidad("GALLINAZA", 3, "bulto")).toBe("3 bultos");
    expect(formatoCantidad("GALLINAZA", 1, "viaje")).toBe("1 viaje");
    expect(formatoCantidad("CUBETA", 65)).toBe("2 cubetas + 5 huevos");
    expect(nombreProducto({ tipo: "GALLINAZA", nombre: "Gallinaza", unidad: "kilo" })).toBe("Gallinaza (kilo)");
  });
});
