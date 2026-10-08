import { Pestanas } from "@/components/ui";
import { puede, type Operacion, type Permiso } from "@/lib/permisos";

export type Pestana = { href: string; texto: string; permiso: Permiso };

// Cada sección del menú agrupa varias páginas en pestañas. El enlace del menú lleva a la primera que el usuario puede ver.
export const PEDIDOS: Pestana[] = [
  { href: "/pedidos", texto: "Pedidos", permiso: "pedidos.ver" },
  { href: "/rutas", texto: "Rutas y liquidación", permiso: "rutas" },
  { href: "/reparto", texto: "Resumen del reparto", permiso: "pedidos.ver" },
];

export const CONTABILIDAD: Pestana[] = [
  { href: "/ingresos", texto: "Ingresos", permiso: "caja" },
  { href: "/egresos", texto: "Egresos", permiso: "caja" },
  { href: "/precios", texto: "Precios", permiso: "precios" },
  { href: "/caja", texto: "Caja y cierre", permiso: "caja" },
  { href: "/cartera", texto: "Cartera", permiso: "cartera.ver" },
  { href: "/por-pagar", texto: "Por pagar", permiso: "compras" },
  { href: "/reportes", texto: "Reportes", permiso: "reportes" },
];

// Usuarios es solo para crear, ver y editar a quienes trabajan con la empresa; lo que deben o se les debe está en Contabilidad.
export const USUARIOS: Pestana[] = [
  { href: "/clientes", texto: "Clientes", permiso: "clientes.ver" },
  { href: "/proveedores", texto: "Proveedores", permiso: "compras" },
  { href: "/usuarios", texto: "Empleados", permiso: "usuarios" },
];

/** Primera página de la sección que la operación puede ver, o null si no ve ninguna. */
export function inicioSeccion(pestanas: readonly Pestana[], operacion: Operacion): string | null {
  return pestanas.find((p) => puede(operacion, p.permiso))?.href ?? null;
}

function PestanasSeccion({
  lista,
  actual,
  operacion,
  params,
}: {
  lista: Pestana[];
  actual: string;
  operacion: Operacion;
  /** Filtros que se conservan al cambiar de pestaña, por página (por ejemplo el día de la caja). */
  params?: Record<string, string | undefined>;
}) {
  return (
    <Pestanas
      actual={actual}
      pestanas={lista
        .filter((p) => puede(operacion, p.permiso))
        .map((p) => ({ href: params?.[p.href] ? `${p.href}?${params[p.href]}` : p.href, texto: p.texto }))}
    />
  );
}

/** Pedidos reúne los pedidos, quién lleva qué (y su liquidación) y el resumen del reparto de un día. */
export function PestanasPedidos({ actual, operacion, fecha }: { actual: "/pedidos" | "/rutas" | "/reparto"; operacion: Operacion; fecha?: string }) {
  const q = fecha ? `fecha=${fecha}` : undefined;
  return <PestanasSeccion lista={PEDIDOS} actual={actual} operacion={operacion} params={{ "/rutas": q, "/reparto": q }} />;
}

/** Contabilidad: lo que entra, lo que sale, los precios, el cierre de la caja, lo que nos deben, lo que debemos y los reportes. */
export function PestanasContabilidad({ actual, operacion, dia }: { actual: string; operacion: Operacion; dia?: string }) {
  const q = dia ? `dia=${dia}` : undefined;
  return <PestanasSeccion lista={CONTABILIDAD} actual={actual} operacion={operacion} params={{ "/ingresos": q, "/egresos": q, "/caja": q }} />;
}

export function PestanasUsuarios({ actual, operacion }: { actual: "/clientes" | "/proveedores" | "/usuarios"; operacion: Operacion }) {
  return <PestanasSeccion lista={USUARIOS} actual={actual} operacion={operacion} />;
}
