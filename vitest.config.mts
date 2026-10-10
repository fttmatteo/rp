import { defineConfig } from "vitest/config";
import path from "node:path";

const raiz = import.meta.dirname;

// Base de datos solo para las pruebas de integración: se vacía antes de cada prueba.
const BD_PRUEBAS = process.env.DATABASE_URL_PRUEBAS ?? "postgresql://rp:rp@localhost:5432/rp_pruebas";

const resolve = {
  alias: {
    "@": path.resolve(raiz, "src"),
    // Fuera de Next, "server-only" lanza un error al importarse; en las pruebas no hace nada.
    "server-only": path.resolve(raiz, "node_modules/server-only/empty.js"),
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: { name: "unitarias", include: ["src/**/*.test.ts"], exclude: ["src/pruebas/**"] },
      },
      {
        resolve,
        test: {
          name: "integracion",
          include: ["src/pruebas/**/*.test.ts"],
          env: { DATABASE_URL: BD_PRUEBAS },
          globalSetup: ["src/pruebas/preparar-bd.ts"],
          setupFiles: ["src/pruebas/entorno.ts"],
          // Todas comparten una base de datos: una a la vez.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Se mide el código del servidor: reglas de negocio, acceso a datos, acciones y rutas.
      // Las pantallas (.tsx) se comprueban con el chequeo de tipos y el build.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/pruebas/**", "src/**/*.d.ts"],
      reporter: ["text-summary", "text", "html", "lcov", "json-summary"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
