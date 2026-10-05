import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { esOperacion, puede, tieneAcceso, type Operacion, type Permiso } from "@/lib/permisos";

const COOKIE = "rp_sesion";
const DURACION_MS = 12 * 60 * 60 * 1000; // una jornada

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function crearSesion(usuarioId: number, operacion: Operacion | null = null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DURACION_MS);
  // De paso se limpian las sesiones vencidas para que la tabla no crezca sin fin.
  await db.$transaction([
    db.sesion.deleteMany({ where: { expira: { lt: new Date() } } }),
    db.sesion.create({ data: { id: hash(token), usuarioId, expira, operacion } }),
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expira,
  });
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.sesion.deleteMany({ where: { id: hash(token) } });
  jar.delete(COOKIE);
}

export interface SesionActual {
  sesionId: string;
  usuario: { id: number; nombre: string; usuario: string; accesos: Operacion[] };
  operacion: Operacion | null;
}

/** Se memoriza por petición: layout, página y acciones comparten una sola consulta. */
export const obtenerSesion = cache(async function obtenerSesion(): Promise<SesionActual | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sesion = await db.sesion.findUnique({ where: { id: hash(token) }, include: { usuario: true } });
  if (!sesion || sesion.expira < new Date() || !sesion.usuario.activo) return null;
  const accesos = sesion.usuario.accesos.filter(esOperacion);
  // Si el administrador le quitó el acceso, la operación activa deja de valer.
  const operacion = sesion.operacion && tieneAcceso(accesos, sesion.operacion) ? sesion.operacion : null;
  return {
    sesionId: sesion.id,
    usuario: { id: sesion.usuario.id, nombre: sesion.usuario.nombre, usuario: sesion.usuario.usuario, accesos },
    operacion,
  };
});

export async function elegirOperacion(sesionId: string, operacion: Operacion): Promise<void> {
  await db.sesion.update({ where: { id: sesionId }, data: { operacion } });
}

/** Exige sesión iniciada. */
export async function requerirSesion(): Promise<SesionActual> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion;
}

/** Exige sesión con operación elegida y, si se indica, un permiso de esa operación. */
export async function requerir(permiso?: Permiso): Promise<SesionActual & { operacion: Operacion }> {
  const sesion = await requerirSesion();
  if (!sesion.operacion) redirect("/operacion");
  if (permiso && !puede(sesion.operacion, permiso)) redirect("/sin-acceso");
  return sesion as SesionActual & { operacion: Operacion };
}
