import { Pestanas } from "@/components/ui";
import { puede, type Operacion } from "@/lib/permisos";

/** Ingresos agrupa el dinero que entra del día y los pedidos, que terminan en ventas. */
export function PestanasIngresos({ actual, operacion }: { actual: "/ingresos" | "/pedidos"; operacion: Operacion }) {
  return (
    <Pestanas
      actual={actual}
      pestanas={[
        ...(puede(operacion, "caja") ? [{ href: "/ingresos", texto: "Registro del día" }] : []),
        ...(puede(operacion, "pedidos.ver") ? [{ href: "/pedidos", texto: "Pedidos" }] : []),
      ]}
    />
  );
}

/** Rutas reúne quién lleva qué (y su liquidación) y el resumen del reparto de ese mismo día. */
export function PestanasRutas({ actual, operacion, fecha }: { actual: "/rutas" | "/reparto"; operacion: Operacion; fecha: string }) {
  return (
    <Pestanas
      actual={actual}
      pestanas={[
        ...(puede(operacion, "rutas") ? [{ href: `/rutas?fecha=${fecha}`, texto: "Rutas y liquidación" }] : []),
        ...(puede(operacion, "pedidos.ver") ? [{ href: `/reparto?fecha=${fecha}`, texto: "Resumen del reparto" }] : []),
      ]}
    />
  );
}
