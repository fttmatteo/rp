import { describe, expect, it } from "vitest";
import { liquidarRuta, ordenarPorZona, ordenManual, validarEntregadas } from "./rutas";

const parada = (id: number, zona: string | null, cliente: string, orden: number | null = null) => ({
  id,
  zona,
  direccion: null,
  cliente,
  orden,
});

describe("rutas", () => {
  it("ordena por zona y deja al final las paradas sin zona", () => {
    expect(
      ordenarPorZona([parada(1, "Centro", "Beto"), parada(2, null, "Ana"), parada(3, "Barrio 2", "Caro"), parada(4, "centro", "Ana")]),
    ).toEqual([3, 4, 1, 2]);
  });

  it("el orden manual respeta los números escritos y conserva el resto", () => {
    const paradas = [parada(10, null, "a", 1), parada(11, null, "b", 2), parada(12, null, "c", 3)];
    expect(ordenManual(paradas, new Map([[12, 1]]))).toEqual([10, 12, 11]);
    expect(ordenManual(paradas, new Map([[10, 3]]))).toEqual([11, 10, 12]);
  });

  it("valida lo entregado", () => {
    const lineas = [
      { id: 1, cantidad: 4, nombre: "AA" },
      { id: 2, cantidad: 1, nombre: "Gallina" },
    ];
    expect(validarEntregadas(lineas, new Map([[1, 2]]))).toEqual(
      new Map([
        [1, 2],
        [2, 1],
      ]),
    );
    expect(() => validarEntregadas(lineas, new Map([[1, 5]]))).toThrow(/más de lo pedido/);
    expect(() =>
      validarEntregadas(
        lineas,
        new Map([
          [1, 0],
          [2, 0],
        ]),
      ),
    ).toThrow(/No se entregó nada/);
  });

  it("la liquidación separa los abonos a deudas anteriores", () => {
    const l = liquidarRuta(
      [
        { valor: 100000, medio: "EFECTIVO" },
        { valor: 30000, medio: "TRANSFERENCIA" },
      ],
      { efectivo: 80000, transferencia: 30000 },
    );
    expect(l).toEqual({
      cobradoEfectivo: 100000,
      cobradoTransferencia: 30000,
      abonosEfectivo: 20000,
      abonosTransferencia: 0,
      efectivoEsperado: 100000,
    });
  });
});
