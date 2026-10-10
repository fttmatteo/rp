// Entorno de las pruebas de integración: Next.js simulado (cookies, redirect, revalidatePath)
// y una base de datos vacía, con los productos del seed, antes de cada prueba.
import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { cookiesPrueba } from "@/pruebas/next";

vi.mock("next/headers", () => ({ cookies: async () => cookiesPrueba }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { Redireccion } = await import("@/pruebas/next");
  return {
    redirect: (url: string) => {
      throw new Redireccion(url);
    },
  };
});

const PRODUCTOS = [
  { codigo: "JUMBO", nombre: "Jumbo", tipo: "CUBETA", orden: 1, precioGeneral: 23000 },
  { codigo: "AA", nombre: "AA", tipo: "CUBETA", orden: 3, precioGeneral: 18000, precioClienteSugerido: 17000 },
  { codigo: "A", nombre: "A", tipo: "CUBETA", orden: 4, precioGeneral: 15000 },
  { codigo: "GALLINA", nombre: "Gallina", tipo: "GALLINA", orden: 6, precioGeneral: 22000 },
  { codigo: "GALLINAZA", nombre: "Gallinaza", tipo: "GALLINAZA", orden: 7, precioGeneral: 0, unidad: "bulto", activo: false },
] as const;

beforeEach(async () => {
  const tablas = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tablas.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await db.producto.createMany({ data: [...PRODUCTOS] });
  cookiesPrueba.limpiar();
});

afterAll(async () => {
  await db.$disconnect();
});
