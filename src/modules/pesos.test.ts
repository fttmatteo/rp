import { describe, expect, it } from "vitest";
import { textoRangoGramos } from "./pesos";

describe("textoRangoGramos", () => {
  it("muestra el rango según los límites que tenga", () => {
    expect(textoRangoGramos({ gramosMin: 60, gramosMax: 66 })).toBe("60 a 66 g");
    expect(textoRangoGramos({ gramosMin: 78, gramosMax: null })).toBe("78 g o más");
    expect(textoRangoGramos({ gramosMin: null, gramosMax: 44 })).toBe("hasta 44 g");
    expect(textoRangoGramos({ gramosMin: 50, gramosMax: 50 })).toBe("50 g");
    expect(textoRangoGramos({ gramosMin: null, gramosMax: null })).toBeNull();
  });
});
