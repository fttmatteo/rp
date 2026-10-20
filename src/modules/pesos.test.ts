import { describe, expect, it } from "vitest";
import { rangosCruzados, textoRangoGramos } from "./pesos";

describe("textoRangoGramos", () => {
  it("muestra el rango según los límites que tenga", () => {
    expect(textoRangoGramos({ gramosMin: 60, gramosMax: 66 })).toBe("60 a 66 g");
    expect(textoRangoGramos({ gramosMin: 78, gramosMax: null })).toBe("78 g o más");
    expect(textoRangoGramos({ gramosMin: null, gramosMax: 44 })).toBe("hasta 44 g");
    expect(textoRangoGramos({ gramosMin: 50, gramosMax: 50 })).toBe("50 g");
    expect(textoRangoGramos({ gramosMin: null, gramosMax: null })).toBeNull();
  });
});

describe("rangosCruzados", () => {
  const r = (nombre: string, gramosMin: number | null, gramosMax: number | null) => ({ nombre, gramosMin, gramosMax });

  it("acepta rangos seguidos y tipos sin rango", () => {
    expect(rangosCruzados([r("Jumbo", 78, null), r("AAA", 67, 77), r("AA", 60, 66), r("B", null, 44), r("A", null, null)])).toBeNull();
  });
  it("encuentra el primer par que se cruza, también con límites abiertos", () => {
    expect(rangosCruzados([r("AAA", 67, 77), r("AA", 60, 67)])).toEqual(["AAA", "AA"]);
    expect(rangosCruzados([r("Jumbo", 70, null), r("AAA", 67, 77)])).toEqual(["Jumbo", "AAA"]);
    expect(rangosCruzados([r("B", null, 50), r("A", 45, 59)])).toEqual(["B", "A"]);
  });
});
