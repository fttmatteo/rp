// Configuración de Prisma 7: dónde está el esquema, las migraciones, el seed y la base de datos.
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee el .env solo. En Docker las variables llegan del entorno y no hay .env.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // Puede faltar al generar el cliente (npm install, build de Docker): solo lo usan migrate y seed.
    url: process.env.DATABASE_URL ?? "",
    // Base desechable para comparar migraciones con el esquema (chequeo de CI).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
