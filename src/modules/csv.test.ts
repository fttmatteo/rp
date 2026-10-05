import { describe, expect, it } from "vitest";
import { aCsv } from "./csv";

describe("csv", () => {
  it("separa con punto y coma y escapa comillas", () => {
    expect(aCsv(["Cliente", "Valor"], [['Tienda "La 1"; centro', 15000]])).toBe('﻿Cliente;Valor\r\n"Tienda ""La 1""; centro";15000\r\n');
  });
});
