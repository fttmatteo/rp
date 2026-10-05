import { describe, expect, it } from "vitest";
import { cierreReparto, valoresPedido } from "./reparto";

const AA = 3;
const GALLINA = 6;

describe("reparto", () => {
  it("pedido entregado con pago parcial deja el resto pendiente", () => {
    const p = {
      entregado: true,
      detalles: [{ productoId: AA, cantidad: 4, precioUnitario: 17000 }],
      pagos: [{ valor: 50000, medio: "EFECTIVO" as const }],
    };
    expect(valoresPedido(p)).toEqual({ valor: 68000, pagado: 50000, pendiente: 18000 });
  });

  it("pedido sin entregar no tiene pagado ni pendiente", () => {
    const p = { entregado: false, detalles: [{ productoId: AA, cantidad: 2, precioUnitario: 18000 }], pagos: [] };
    expect(valoresPedido(p)).toEqual({ valor: 36000, pagado: 0, pendiente: 0 });
  });

  it("cierre suma cantidades por clasificación y separa efectivo y transferencia", () => {
    const c = cierreReparto([
      {
        entregado: true,
        detalles: [
          { productoId: AA, cantidad: 4, precioUnitario: 17000 },
          { productoId: GALLINA, cantidad: 1, precioUnitario: 22000 },
        ],
        pagos: [{ valor: 90000, medio: "EFECTIVO" }],
      },
      {
        entregado: true,
        detalles: [{ productoId: AA, cantidad: 2, precioUnitario: 18000 }],
        pagos: [{ valor: 10000, medio: "TRANSFERENCIA" }],
      },
      { entregado: false, detalles: [{ productoId: AA, cantidad: 5, precioUnitario: 18000 }], pagos: [] },
    ]);
    expect(c.porProducto).toEqual([
      { productoId: AA, llevado: 11, entregado: 6, porEntregar: 5, devuelto: 0, valorEntregado: 104000 },
      { productoId: GALLINA, llevado: 1, entregado: 1, porEntregar: 0, devuelto: 0, valorEntregado: 22000 },
    ]);
    expect(c.valorEntregado).toBe(126000);
    expect(c.valorPorEntregar).toBe(90000);
    expect(c.pagadoEfectivo).toBe(90000);
    expect(c.pagadoTransferencia).toBe(10000);
    expect(c.pagado).toBe(100000);
    expect(c.pendiente).toBe(26000);
  });

  it("entrega parcial cobra solo lo entregado y el resto vuelve", () => {
    const p = {
      entregado: true,
      detalles: [{ productoId: AA, cantidad: 5, cantidadEntregada: 3, precioUnitario: 18000 }],
      pagos: [{ valor: 54000, medio: "EFECTIVO" as const }],
    };
    expect(valoresPedido(p)).toEqual({ valor: 54000, pagado: 54000, pendiente: 0 });
    const c = cierreReparto([p, { entregado: false, noEntregado: true, detalles: [{ productoId: AA, cantidad: 2, precioUnitario: 18000 }], pagos: [] }]);
    expect(c.porProducto).toEqual([{ productoId: AA, llevado: 7, entregado: 3, porEntregar: 0, devuelto: 4, valorEntregado: 54000 }]);
    expect(c.valorPorEntregar).toBe(0);
    expect(c.entregados).toBe(1);
    expect(c.noEntregados).toBe(1);
  });
});
