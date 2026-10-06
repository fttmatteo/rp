import { describe, expect, it } from "vitest";
import { aCsv } from "./csv";

describe("csv", () => {
  it("separa con punto y coma y escapa comillas", () => {
    expect(aCsv(["Cliente", "Valor"], [['Tienda "La 1"; centro', 15000]])).toBe('﻿Cliente;Valor\r\n"Tienda ""La 1""; centro";15000\r\n');
  });

  it("neutraliza textos que Excel tomaría como fórmula", () => {
    expect(aCsv(["Cliente"], [["=HYPERLINK(\"http://x\")"], ["+57 300"], ["-1"], ["@SUM(A1)"], ["Tienda"]])).toBe(
      '﻿Cliente\r\n"\'=HYPERLINK(""http://x"")"\r\n\'+57 300\r\n\'-1\r\n\'@SUM(A1)\r\nTienda\r\n',
    );
  });
});
