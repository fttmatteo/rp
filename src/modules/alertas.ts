import { HUEVOS_POR_CUBETA } from "@/lib/formato";

export interface ProductoStock {
  id: number;
  nombre: string;
  tipo: "CUBETA" | "GALLINA" | "GALLINAZA";
  minimo: number | null;
  existencias: number; // huevos para cubetas
}

/** Productos por debajo de su mínimo. El mínimo de las cubetas se escribe en cubetas, no en huevos. */
export function existenciasBajas(productos: ProductoStock[]): ProductoStock[] {
  return productos.filter((p) => {
    if (p.minimo === null) return false;
    const disponible = p.tipo === "CUBETA" ? p.existencias / HUEVOS_POR_CUBETA : p.existencias;
    return disponible < p.minimo;
  });
}
