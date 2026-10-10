import { describe, expect, it } from "vitest";
import {
  diaUTC,
  formatoCantidad,
  formatoConsecutivo,
  formatoDia,
  formatoFecha,
  formatoFechaHora,
  formatoHora,
  formatoHuevos,
  formatoPesos,
  hoyISO,
  nombreProducto,
  sumarDias,
} from "./formato";

// Espacios no separables de Intl a espacios normales, para comparar.
const plano = (t: string) => t.replace(/[  ]/g, " ");

describe("formato de productos", () => {
  it("muestra la gallinaza en su unidad", () => {
    expect(formatoCantidad("GALLINAZA", 3, "bulto")).toBe("3 bultos");
    expect(formatoCantidad("GALLINAZA", 1, "viaje")).toBe("1 viaje");
    expect(formatoCantidad("GALLINAZA", 2)).toBe("2 bultos");
    expect(formatoCantidad("CUBETA", 65)).toBe("2 cubetas + 5 huevos");
    expect(formatoCantidad("GALLINA", 1)).toBe("1 gallina");
    expect(formatoCantidad("GALLINA", 4)).toBe("4 gallinas");
    expect(nombreProducto({ tipo: "GALLINAZA", nombre: "Gallinaza", unidad: "kilo" })).toBe("Gallinaza (kilo)");
    expect(nombreProducto({ tipo: "GALLINAZA", nombre: "Gallinaza" })).toBe("Gallinaza (bulto)");
    expect(nombreProducto({ tipo: "CUBETA", nombre: "AA" })).toBe("Cubeta AA");
    expect(nombreProducto({ tipo: "GALLINA", nombre: "Gallina" })).toBe("Gallina");
  });

  it("huevos en cubetas de 30, también negativos", () => {
    expect(formatoHuevos(30)).toBe("1 cubeta");
    expect(formatoHuevos(31)).toBe("1 cubeta + 1 huevo");
    expect(formatoHuevos(-62)).toBe("-2 cubetas + 2 huevos");
    expect(formatoHuevos(0)).toBe("0 cubetas");
  });
});

describe("fechas y dinero", () => {
  it("el día de hoy es el de Bogotá, no el de UTC", () => {
    // 2 a. m. UTC del 5 de octubre son las 9 p. m. del 4 en Bogotá.
    expect(hoyISO(new Date("2026-10-05T02:00:00Z"))).toBe("2026-10-04");
    expect(hoyISO(new Date("2026-10-05T05:00:00Z"))).toBe("2026-10-05");
  });

  it("días a medianoche UTC y sumas de días entre meses", () => {
    expect(diaUTC("2026-10-31").toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(sumarDias(diaUTC("2026-10-31"), 1).toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(sumarDias(diaUTC("2026-03-01"), -1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(formatoDia(diaUTC("2026-10-04"))).toBe("04/10/2026");
  });

  it("fecha y hora en Bogotá", () => {
    const d = new Date("2026-10-05T02:30:00Z");
    expect(formatoFecha(d)).toBe("04/10/2026");
    expect(plano(formatoFechaHora(d))).toMatch(/^04\/10\/2026,? 09:30 p\. ?m\.$/);
    expect(plano(formatoHora(d))).toMatch(/^09:30 p\. ?m\.$/);
  });

  it("pesos sin decimales y consecutivos", () => {
    expect(plano(formatoPesos(1234567))).toBe("$ 1.234.567");
    expect(formatoConsecutivo("RP", 42)).toBe("RP-000042");
  });
});
