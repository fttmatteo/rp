import { describe, expect, it } from "vitest";
import { mensajeEnCamino, mensajeEstadoCuenta, mensajePedido, mensajeRecibo, mensajeRecordatorio } from "./mensajes";

describe("mensajes de WhatsApp", () => {
  it("arma el pedido y el recibo", () => {
    expect(mensajePedido({ cliente: "Rosa", fecha: "05/10/2026", lineas: [{ cantidad: 2, producto: "Cubeta AA" }], total: 36000 })).toContain("• 2 Cubeta AA");
    const r = mensajeRecibo({ cliente: "Rosa", numero: "RP-000001", total: 36000, pagado: 20000, saldoTotal: 16000 });
    expect(r).toContain("Queda pendiente: $ 16.000");
  });
  it("estado de cuenta al día", () => {
    expect(mensajeEstadoCuenta({ cliente: "Rosa", deudas: [] })).toContain("al día");
  });
  it("estado de cuenta con deudas vencidas", () => {
    const m = mensajeEstadoCuenta({
      cliente: "Rosa",
      deudas: [
        { numero: "RP-000001", fecha: "01/09/2026", saldo: 10000, vencida: true },
        { numero: "RP-000002", fecha: "01/10/2026", saldo: 5000, vencida: false },
      ],
    });
    expect(m).toContain("• RP-000001 del 01/09/2026: $ 10.000 (vencida)");
    expect(m).toContain("• RP-000002 del 01/10/2026: $ 5.000\n");
    expect(m).toContain("Total pendiente: $ 15.000");
  });
  it("recibo pagado completo no menciona pendientes", () => {
    const r = mensajeRecibo({ cliente: "Rosa", numero: "RP-000003", total: 18000, pagado: 18000, saldoTotal: 0 });
    expect(r).not.toContain("pendiente");
    expect(r).not.toContain("Saldo total");
  });
  it("recordatorio y aviso de entrega", () => {
    expect(mensajeRecordatorio({ cliente: "Rosa", vencido: 25000, dias: 12 })).toContain("saldo vencido de $ 25.000 desde hace 12 días");
    expect(mensajeEnCamino("Rosa")).toBe("Hola Rosa, su pedido de huevos va en camino. ¡Gracias!");
  });
});
