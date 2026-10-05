// Matriz de accesos (operaciones) y lo que cada uno puede hacer.
// Se usa en el servidor para cada página y acción, no solo para el menú.

export const OPERACIONES = ["ADMIN", "VENTAS", "REPARTIDOR", "GALPONERO"] as const;
export type Operacion = (typeof OPERACIONES)[number];

export const ETIQUETA_OPERACION: Record<Operacion, string> = {
  ADMIN: "Administrador",
  VENTAS: "Ventas",
  REPARTIDOR: "Repartidor",
  GALPONERO: "Galponero",
};

export type Permiso =
  | "usuarios"
  | "precios"
  | "clientes.ver"
  | "clientes.editar"
  | "inventario.ver"
  | "inventario.ajustar"
  | "clasificacion"
  | "pedidos.ver"
  | "pedidos.crear"
  | "pedidos.entregar"
  | "pagos.registrar"
  | "cartera.ver"
  | "caja"
  | "rutas" // armar rutas, ordenarlas y liquidarlas
  | "ruta.propia" // la ruta del día del repartidor
  | "aves" // galpones, lotes y novedades
  | "compras" // proveedores, compras de huevo a terceros y cuentas por pagar
  | "anular";

const PERMISOS: Record<Exclude<Operacion, "ADMIN">, readonly Permiso[]> = {
  VENTAS: [
    "clientes.ver",
    "clientes.editar",
    "inventario.ver",
    "pedidos.ver",
    "pedidos.crear",
    "pedidos.entregar",
    "pagos.registrar",
    "cartera.ver",
    "caja",
    "rutas",
    "compras",
  ],
  REPARTIDOR: ["clientes.ver", "pedidos.ver", "pedidos.entregar", "pagos.registrar", "ruta.propia"],
  GALPONERO: ["clasificacion", "inventario.ver", "aves"],
};

export function puede(operacion: Operacion, permiso: Permiso): boolean {
  if (operacion === "ADMIN") return true;
  return PERMISOS[operacion].includes(permiso);
}

/** El usuario solo puede entrar a una operación que el administrador le asignó. */
export function tieneAcceso(accesos: readonly string[], operacion: Operacion): boolean {
  return accesos.includes(operacion);
}

export function esOperacion(valor: unknown): valor is Operacion {
  return typeof valor === "string" && (OPERACIONES as readonly string[]).includes(valor);
}
