import { describe, expect, it } from "vitest";
import { existenciasBajas } from "./alertas";

describe("alertas de existencias", () => {
  it("compara las cubetas en cubetas y lo demás en unidades", () => {
    const bajas = existenciasBajas([
      { id: 1, nombre: "AA", tipo: "CUBETA", minimo: 10, existencias: 270 },
      { id: 2, nombre: "A", tipo: "CUBETA", minimo: 10, existencias: 300 },
      { id: 3, nombre: "Gallina", tipo: "GALLINA", minimo: 5, existencias: 4 },
      { id: 4, nombre: "B", tipo: "CUBETA", minimo: null, existencias: 0 },
    ]);
    expect(bajas.map((b) => b.nombre)).toEqual(["AA", "Gallina"]);
  });
});
