// CSV que Excel abre bien en español: separador punto y coma y marca UTF-8 al inicio.

const celda = (v: string | number | null): string => {
  if (v === null) return "";
  if (typeof v === "number") return String(v);
  // Un texto que empieza con = + - @ Excel lo toma como fórmula; el apóstrofo lo deja como texto.
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};

export function aCsv(columnas: string[], filas: (string | number | null)[][]): string {
  return "﻿" + [columnas, ...filas].map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}
