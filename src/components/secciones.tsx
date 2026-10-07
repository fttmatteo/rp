import { Pestanas } from "@/components/ui";
import { puede, type Operacion } from "@/lib/permisos";

export type SeccionDinero = "/ingresos" | "/pedidos" | "/egresos" | "/caja";

/** Dinero agrupa lo que entra (y los pedidos, que terminan en ventas), lo que sale y el cuadre y cierre de la caja. */
export function PestanasDinero({ actual, operacion, dia }: { actual: SeccionDinero; operacion: Operacion; dia?: string }) {
  const q = dia ? `?dia=${dia}` : "";
  const caja = puede(operacion, "caja");
  return (
    <Pestanas
      actual={actual}
      pestanas={[
        ...(caja ? [{ href: `/ingresos${q}`, texto: "Ingresos" }] : []),
        ...(puede(operacion, "pedidos.ver") ? [{ href: "/pedidos", texto: "Pedidos" }] : []),
        ...(caja
          ? [
              { href: `/egresos${q}`, texto: "Egresos" },
              { href: `/caja${q}`, texto: "Caja y cierre" },
            ]
          : []),
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
