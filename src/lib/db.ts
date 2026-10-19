import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const global = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 se conecta a PostgreSQL con el adaptador de "pg".
export const db = global.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") global.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
