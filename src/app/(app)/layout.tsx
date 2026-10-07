import Link from "next/link";
import { ETIQUETA_OPERACION, puede, type Permiso } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { salir } from "../login/acciones";

const MENU: { href: string; texto: string; permiso?: Permiso }[] = [
  { href: "/", texto: "Inicio" },
  { href: "/mi-ruta", texto: "Mi ruta", permiso: "ruta.propia" },
  { href: "/rutas", texto: "Rutas", permiso: "rutas" },
  { href: "/clientes", texto: "Clientes", permiso: "clientes.ver" },
  { href: "/cartera", texto: "Cartera", permiso: "cartera.ver" },
  // Dinero reúne Ingresos, Pedidos, Egresos y Caja; Rutas incluye el resumen del reparto (pestañas dentro de la página).
  { href: "/ingresos", texto: "Dinero", permiso: "caja" },
  // Inventario reúne existencias, clasificación y aves (pestañas dentro de la página).
  { href: "/inventario", texto: "Inventario", permiso: "inventario.ver" },
  { href: "/proveedores", texto: "Proveedores", permiso: "compras" },
  { href: "/reportes", texto: "Reportes", permiso: "reportes" },
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
