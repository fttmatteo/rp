import { describe, expect, it } from "vitest";
import { puede, tieneAcceso } from "./permisos";

describe("permisos", () => {
  it("el administrador puede todo", () => {
    expect(puede("ADMIN", "usuarios")).toBe(true);
    expect(puede("ADMIN", "anular")).toBe(true);
  });
  it("cada operación solo lo suyo", () => {
    expect(puede("VENTAS", "pedidos.crear")).toBe(true);
    expect(puede("VENTAS", "precios")).toBe(false);
    expect(puede("REPARTIDOR", "pedidos.entregar")).toBe(true);
    expect(puede("REPARTIDOR", "pedidos.crear")).toBe(false);
    expect(puede("REPARTIDOR", "pedidos.ver")).toBe(false);
    expect(puede("REPARTIDOR", "clientes.ver")).toBe(false);
    expect(puede("REPARTIDOR", "ruta.propia")).toBe(true);
    expect(puede("REPARTIDOR", "rutas.aprobar")).toBe(false);
    expect(puede("VENTAS", "rutas.aprobar")).toBe(false);
    expect(puede("ADMIN", "rutas.aprobar")).toBe(true);
    // Mi ruta es solo del repartidor.
    expect(puede("ADMIN", "ruta.propia")).toBe(false);
    expect(puede("VENTAS", "ruta.propia")).toBe(false);
    // Todo lo del inventario (clasificación, aves y ajustes) es del administrador; ventas solo lo consulta.
    expect(puede("VENTAS", "clasificacion")).toBe(false);
    expect(puede("VENTAS", "aves")).toBe(false);
    expect(puede("VENTAS", "inventario.ajustar")).toBe(false);
    expect(puede("VENTAS", "inventario.ver")).toBe(true);
    expect(puede("ADMIN", "aves")).toBe(true);
    expect(puede("VENTAS", "reportes")).toBe(true);
    expect(puede("REPARTIDOR", "reportes")).toBe(false);
  });
  it("solo se entra a operaciones asignadas", () => {
    expect(tieneAcceso(["VENTAS", "REPARTIDOR"], "REPARTIDOR")).toBe(true);
    expect(tieneAcceso(["VENTAS"], "REPARTIDOR")).toBe(false);
  });
});
