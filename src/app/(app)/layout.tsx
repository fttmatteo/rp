import Link from "next/link";
import { ETIQUETA_OPERACION, puede, type Permiso } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { salir } from "../login/acciones";

const MENU: { href: string; texto: string; permiso?: Permiso }[] = [
  { href: "/", texto: "Inicio" },
  { href: "/pedidos", texto: "Pedidos", permiso: "pedidos.ver" },
  { href: "/reparto", texto: "Reparto", permiso: "pedidos.ver" },
  { href: "/clientes", texto: "Clientes", permiso: "clientes.ver" },
  { href: "/cartera", texto: "Cartera", permiso: "cartera.ver" },
  { href: "/caja", texto: "Caja", permiso: "caja" },
  { href: "/inventario", texto: "Inventario", permiso: "inventario.ver" },
  { href: "/clasificacion", texto: "Clasificación", permiso: "clasificacion" },
  { href: "/precios", texto: "Precios", permiso: "precios" },
  { href: "/usuarios", texto: "Usuarios", permiso: "usuarios" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requerir();
  const menu = MENU.filter((m) => !m.permiso || puede(sesion.operacion, m.permiso));
  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link href="/" className="font-semibold">
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
    </>
  );
}
