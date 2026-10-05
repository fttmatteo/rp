import { describe, expect, it, vi } from "vitest";
import { entero, ErrorUsuario, mensajeError } from "./form";

function form(datos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
}

describe("entero", () => {
  it("usa la etiqueta visible en el mensaje, no el nombre interno", () => {
    expect(() => entero(form({ cantidad_3: "abc" }), "cantidad_3", "Cantidad de AAA")).toThrow(/^Cantidad de AAA:/);
  });
  it("acepta separadores de miles", () => {
    expect(entero(form({ v: "15.000" }), "v", "Valor")).toBe(15000);
  });
});

describe("mensajeError", () => {
  it("traduce los errores conocidos de la base de datos", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensajeError(new ErrorUsuario("x"))).toBe("x");
    expect(mensajeError({ code: "P2025" })).toMatch(/ya no existe/);
    expect(mensajeError({ name: "PrismaClientInitializationError" })).toMatch(/conexión/);
    expect(mensajeError(new Error("otro"))).toMatch(/inesperado/);
  });
});
