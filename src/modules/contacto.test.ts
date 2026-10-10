import { describe, expect, it } from "vitest";
import { enlaceLlamar, enlaceMaps, enlaceWhatsApp, telefonoInternacional } from "./contacto";

describe("contacto", () => {
  it("agrega el indicativo a los celulares colombianos", () => {
    expect(telefonoInternacional("300 123 4567")).toBe("573001234567");
    expect(telefonoInternacional("+57 300-123-4567")).toBe("573001234567");
    expect(telefonoInternacional("12")).toBeNull();
  });
  it("arma el enlace de WhatsApp con el mensaje", () => {
    expect(enlaceWhatsApp("3001234567", "Hola & bienvenido")).toBe("https://wa.me/573001234567?text=Hola%20%26%20bienvenido");
    expect(enlaceWhatsApp(null)).toBeNull();
  });
  it("Maps usa el GPS si existe y si no la dirección", () => {
    expect(enlaceMaps({ latitud: 4.6, longitud: -74.08, direccion: "Calle 1" })).toContain("query=4.6%2C-74.08");
    expect(enlaceMaps({ direccion: "Calle 1 # 2-3", zona: "Centro" })).toContain("query=Calle%201%20%23%202-3%2C%20Centro");
    expect(enlaceMaps({})).toBeNull();
  });
  it("enlace para llamar con solo dígitos y +", () => {
    expect(enlaceLlamar("+57 (300) 123-4567")).toBe("tel:+573001234567");
    expect(enlaceLlamar("")).toBeNull();
    expect(enlaceLlamar(null)).toBeNull();
    expect(telefonoInternacional("6012345678")).toBe("6012345678");
    expect(telefonoInternacional(undefined)).toBeNull();
  });
});
