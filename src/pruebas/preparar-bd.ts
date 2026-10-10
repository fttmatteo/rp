// Antes de las pruebas de integración: aplica las migraciones en la base de pruebas.
import { execSync } from "node:child_process";

export default function prepararBd() {
  const url = process.env.DATABASE_URL_PRUEBAS ?? "postgresql://rp:rp@localhost:5432/rp_pruebas";
  // Las pruebas borran todo: nunca deben apuntar a la base real.
  const nombre = new URL(url).pathname.slice(1);
  if (!/prueba|test/i.test(nombre)) throw new Error(`La base de pruebas debe llamarse con "prueba" o "test" (es "${nombre}").`);
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
