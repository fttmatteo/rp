// CSV que Excel abre bien en español: separador punto y coma y marca UTF-8 al inicio.

const celda = (v: string | number | null): string => {
  if (v === null) return "";
  if (typeof v === "number") return String(v);
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function aCsv(columnas: string[], filas: (string | number | null)[][]): string {
  return "﻿" + [columnas, ...filas].map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}
