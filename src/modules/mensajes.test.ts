import { describe, expect, it } from "vitest";
import { mensajeEstadoCuenta, mensajePedido, mensajeRecibo } from "./mensajes";

describe("mensajes de WhatsApp", () => {
  it("arma el pedido y el recibo", () => {
    expect(mensajePedido({ cliente: "Rosa", fecha: "05/10/2026", lineas: [{ cantidad: 2, producto: "Cubeta AA" }], total: 36000 })).toContain("• 2 Cubeta AA");
    const r = mensajeRecibo({ cliente: "Rosa", numero: "RP-000001", total: 36000, pagado: 20000, saldoTotal: 16000 });
    expect(r).toContain("Queda pendiente: $ 16.000");
  });
  it("estado de cuenta al día", () => {
    expect(mensajeEstadoCuenta({ cliente: "Rosa", deudas: [] })).toContain("al día");
  });
});
