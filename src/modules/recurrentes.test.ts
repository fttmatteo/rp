import { describe, expect, it } from "vitest";
import { diaDeLaSemana, normalizarDias, textoDias, tocaElDia } from "./recurrentes";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

it("diaDeLaSemana", () => {
  expect(diaDeLaSemana(dia("2026-10-19"))).toBe(1); // lunes
  expect(diaDeLaSemana(dia("2026-10-25"))).toBe(0); // domingo
});

describe("tocaElDia", () => {
  const lunesYJueves = { diasSemana: [1, 4], desde: dia("2026-10-20") };
  it("toca en sus días desde que empieza", () => {
    expect(tocaElDia(lunesYJueves, dia("2026-10-22"))).toBe(true);
    expect(tocaElDia(lunesYJueves, dia("2026-10-26"))).toBe(true);
  });
  it("no toca otros días ni antes de empezar", () => {
    expect(tocaElDia(lunesYJueves, dia("2026-10-21"))).toBe(false);
    expect(tocaElDia(lunesYJueves, dia("2026-10-19"))).toBe(false);
  });
});

it("normalizarDias quita repetidos y los que no existen, y ordena desde el lunes", () => {
  expect(normalizarDias([0, 3, 3, 9, 1])).toEqual([1, 3, 0]);
});

it("textoDias", () => {
  expect(textoDias([])).toBe("");
  expect(textoDias([1])).toBe("lunes");
  expect(textoDias([4, 1])).toBe("lunes y jueves");
  expect(textoDias([1, 3, 5])).toBe("lunes, miércoles y viernes");
  expect(textoDias([0, 1, 2, 3, 4, 5, 6])).toBe("todos los días");
});
