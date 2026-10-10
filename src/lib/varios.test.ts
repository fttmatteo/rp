import { afterEach, describe, expect, it } from "vitest";
import { ETAPA_AVES, TIPO_NOVEDAD } from "./etiquetas-aves";
import { esParcial, ESTADO_PEDIDO, ESTADO_RUTA } from "./estados";
import { CREDITO_DOCUMENTOS, nombreEmpresa } from "./marca";
import { respuestaPdf } from "./respuesta-pdf";
import { normalizar } from "./texto";

describe("estados y etiquetas", () => {
  it("entrega parcial: alguna línea con menos de lo pedido", () => {
    expect(esParcial([{ cantidad: 3, cantidadEntregada: 3 }, { cantidad: 2, cantidadEntregada: 1 }])).toBe(true);
    expect(esParcial([{ cantidad: 3, cantidadEntregada: 3 }])).toBe(false);
    expect(esParcial([{ cantidad: 3, cantidadEntregada: null }])).toBe(false);
  });
  it("cada estado tiene su texto", () => {
    expect(ESTADO_PEDIDO.NO_ENTREGADO.texto).toBe("No entregado");
    expect(ESTADO_RUTA.PRECERRADA.texto).toBe("Por aprobar");
    expect(ETAPA_AVES.CRIA).toBe("Cría");
    expect(TIPO_NOVEDAD.VENTA).toBe("Paso a venta");
  });
});

describe("marca", () => {
  const anterior = process.env.EMPRESA_NOMBRE;
  afterEach(() => {
    process.env.EMPRESA_NOMBRE = anterior;
  });
  it("el nombre de la empresa sale de EMPRESA_NOMBRE", () => {
    process.env.EMPRESA_NOMBRE = "  Huevos La Granja ";
    expect(nombreEmpresa()).toBe("Huevos La Granja");
    delete process.env.EMPRESA_NOMBRE;
    expect(nombreEmpresa()).toBe("");
    expect(CREDITO_DOCUMENTOS).toBe("Generado con RP Software");
  });
});

describe("utilidades", () => {
  it("normaliza búsquedas sin tildes ni mayúsculas", () => {
    expect(normalizar("Doña JOSÉ Pérez")).toBe("dona jose perez");
  });
  it("respuesta PDF para ver en el navegador, sin guardar en caché", async () => {
    const r = respuestaPdf(new Uint8Array([37, 80, 68, 70]), "RP-000001");
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(r.headers.get("Content-Disposition")).toBe('inline; filename="RP-000001.pdf"');
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));
  });
});
