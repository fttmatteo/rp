// Matriz de accesos (operaciones) y lo que cada uno puede hacer.
// Se usa en el servidor para cada página y acción, no solo para el menú.

export const OPERACIONES = ["ADMIN", "VENTAS", "REPARTIDOR"] as const;
export type Operacion = (typeof OPERACIONES)[number];

export const ETIQUETA_OPERACION: Record<Operacion, string> = {
  ADMIN: "Administrador",
  VENTAS: "Ventas",
  REPARTIDOR: "Repartidor",
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
  | "pedidos.aprobar" // aprobar los pedidos que generan los recurrentes (solo administrador)
  | "pedidos.entregar"
  | "pagos.registrar"
  | "cartera.ver"
  | "caja"
  | "rutas" // ver las rutas del día, ordenarlas y quitarles pedidos
  | "rutas.aprobar" // aprobar el precierre del repartidor y liquidar la ruta (solo administrador)
  | "ruta.propia" // la ruta del día del repartidor: toma pedidos, entrega, cobra y hace el precierre
  | "aves" // galpones y novedades de las aves
  | "compras" // proveedores, compras de huevo a terceros y cuentas por pagar
  | "reportes" // reportes y exportaciones
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
    "reportes",
  ],
  // El repartidor trabaja desde "Mi ruta": no ve la lista general de pedidos, el reparto del día ni los clientes.
  REPARTIDOR: ["pedidos.entregar", "pagos.registrar", "ruta.propia"],
};

/** Solo el repartidor tiene una ruta propia; al administrador no se le muestra Mi ruta. */
const SOLO_REPARTIDOR: readonly Permiso[] = ["ruta.propia"];

export function puede(operacion: Operacion, permiso: Permiso): boolean {
  if (operacion === "ADMIN") return !SOLO_REPARTIDOR.includes(permiso);
  return PERMISOS[operacion].includes(permiso);
}

/** El usuario solo puede entrar a una operación que el administrador le asignó. */
export function tieneAcceso(accesos: readonly string[], operacion: Operacion): boolean {
  return accesos.includes(operacion);
}

export function esOperacion(valor: unknown): valor is Operacion {
  return typeof valor === "string" && (OPERACIONES as readonly string[]).includes(valor);
}
