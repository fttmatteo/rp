import { Pestanas } from "@/components/ui";
import { puede, type Operacion } from "@/lib/permisos";

/** Todo lo del inventario en un solo lugar: existencias, clasificación (producción) y aves. */
export function PestanasInventario({ actual, operacion }: { actual: "/inventario" | "/clasificacion" | "/aves"; operacion: Operacion }) {
  return (
    <Pestanas
      actual={actual}
      pestanas={[
        { href: "/inventario", texto: "Existencias y movimientos" },
        ...(puede(operacion, "clasificacion") ? [{ href: "/clasificacion", texto: "Clasificación" }] : []),
        ...(puede(operacion, "aves") ? [{ href: "/aves", texto: "Aves" }] : []),
      ]}
    />
  );
}
