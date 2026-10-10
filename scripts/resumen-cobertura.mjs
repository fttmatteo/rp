// Tabla de cobertura en Markdown para el resumen de la corrida en GitHub Actions.
import { existsSync, readFileSync } from "node:fs";

const archivo = "coverage/coverage-summary.json";
if (!existsSync(archivo)) {
  console.log("### Cobertura\n\nNo se generó el informe (las pruebas fallaron antes de terminar).");
  process.exit(0);
}
const { total } = JSON.parse(readFileSync(archivo, "utf8"));
const fila = (nombre, m) => `| ${nombre} | ${m.pct}% | ${m.covered} de ${m.total} |`;
console.log(
  [
    "### Cobertura del código del servidor",
    "",
    "| Medida | % | Cubierto |",
    "| --- | --- | --- |",
    fila("Líneas", total.lines),
    fila("Instrucciones", total.statements),
    fila("Funciones", total.functions),
    fila("Ramas", total.branches),
  ].join("\n"),
);
