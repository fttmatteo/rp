import Link from "next/link";
import { PieCreditos } from "@/components/creditos";
import { NOMBRE_SOFTWARE, nombreEmpresa } from "@/lib/marca";
import { MenuPrincipal, type EntradaMenu } from "@/components/menu-principal";
import { OcultarEn } from "@/components/ocultar-en";
import { ETIQUETA_OPERACION, puede, type Permiso } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { CONTABILIDAD, inicioSeccion, PEDIDOS, USUARIOS, type Pestana } from "@/components/secciones";
import { salir } from "../login/acciones";

const MENU: ({ href: string; texto: string; permiso?: Permiso; rutas?: string[] } | { texto: string; seccion: Pestana[] })[] = [
  { href: "/", texto: "Inicio" },
  { href: "/mi-ruta", texto: "Mi ruta", permiso: "ruta.propia" },
  // Pedidos, Contabilidad y Usuarios agrupan varias páginas en pestañas (components/secciones.tsx).
  { texto: "Pedidos", seccion: PEDIDOS },
  { texto: "Contabilidad", seccion: CONTABILIDAD },
  // Inventario reúne existencias, clasificación y aves (pestañas dentro de la página).
  { href: "/inventario", texto: "Inventario", permiso: "inventario.ver", rutas: ["/inventario", "/clasificacion", "/aves"] },
  { texto: "Usuarios", seccion: USUARIOS },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requerir();
  const menu = MENU.flatMap((m): EntradaMenu[] => {
    if ("seccion" in m) {
      const href = inicioSeccion(m.seccion, sesion.operacion);
      return href ? [{ href, texto: m.texto, rutas: m.seccion.map((p) => p.href) }] : [];
    }
    return !m.permiso || puede(sesion.operacion, m.permiso) ? [{ href: m.href, texto: m.texto, rutas: m.rutas ?? [m.href] }] : [];
  });
  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          {/* La app es de la empresa: su nombre va arriba. El software se ve en el pie y en "Acerca de". */}
          <Link href="/" className="inline-flex min-h-11 items-center text-lg font-semibold">
            {nombreEmpresa() || NOMBRE_SOFTWARE}
          </Link>
          {/* Cambiar y Salir miden 44px de alto para tocarlos con el pulgar. */}
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="text-stone-600">
              {sesion.usuario.nombre} · <strong className="text-stone-900">{ETIQUETA_OPERACION[sesion.operacion]}</strong>
            </span>
            {sesion.usuario.accesos.length > 1 && (
              <Link href="/operacion" className="inline-flex min-h-11 items-center underline">
                Cambiar
              </Link>
            )}
            <form action={salir}>
              <button type="submit" className="min-h-11 underline">
                Salir
              </button>
            </form>
          </div>
        </div>
        <MenuPrincipal entradas={menu} />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      {/* En "Acerca de" ya están los créditos: el pie no enlaza a la misma página. */}
      <OcultarEn ruta="/acerca">
        <PieCreditos />
      </OcultarEn>
    </>
  );
}
