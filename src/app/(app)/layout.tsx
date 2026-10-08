import Link from "next/link";
import { PieCreditos } from "@/components/creditos";
import { OcultarEn } from "@/components/ocultar-en";
import { ETIQUETA_OPERACION, puede, type Permiso } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { CONTABILIDAD, inicioSeccion, PEDIDOS, USUARIOS, type Pestana } from "@/components/secciones";
import { salir } from "../login/acciones";

const MENU: ({ href: string; texto: string; permiso?: Permiso } | { texto: string; seccion: Pestana[] })[] = [
  { href: "/", texto: "Inicio" },
  { href: "/mi-ruta", texto: "Mi ruta", permiso: "ruta.propia" },
  // Pedidos, Contabilidad y Usuarios agrupan varias páginas en pestañas (components/secciones.tsx).
  { texto: "Pedidos", seccion: PEDIDOS },
  { texto: "Contabilidad", seccion: CONTABILIDAD },
  // Inventario reúne existencias, clasificación y aves (pestañas dentro de la página).
  { href: "/inventario", texto: "Inventario", permiso: "inventario.ver" },
  { texto: "Usuarios", seccion: USUARIOS },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requerir();
  const menu = MENU.flatMap((m) => {
    if ("seccion" in m) {
      const href = inicioSeccion(m.seccion, sesion.operacion);
      return href ? [{ href, texto: m.texto }] : [];
    }
    return !m.permiso || puede(sesion.operacion, m.permiso) ? [m] : [];
  });
  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img src="/icons/svg/icono.svg" alt="" width={32} height={32} className="rounded" />
            RP Software
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-600">
              {sesion.usuario.nombre} · <strong>{ETIQUETA_OPERACION[sesion.operacion]}</strong>
            </span>
            {sesion.usuario.accesos.length > 1 && (
              <Link href="/operacion" className="underline">
                Cambiar
              </Link>
            )}
            <form action={salir}>
              <button type="submit" className="underline">
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4">
          <ul className="flex gap-1 whitespace-nowrap pb-2 text-sm">
            {menu.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="block rounded px-3 py-1.5 hover:bg-stone-100">
                  {m.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      {/* En "Acerca de" ya están los créditos: el pie no enlaza a la misma página. */}
      <OcultarEn ruta="/acerca">
        <PieCreditos />
      </OcultarEn>
    </>
  );
}
