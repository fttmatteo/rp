// Piezas de Next.js que las acciones usan fuera de una petición real.

/** Lo que lanza redirect(): las pruebas comprueban a dónde iba. */
export class Redireccion extends Error {
  constructor(public url: string) {
    super(`Redirección a ${url}`);
  }
}

const valores = new Map<string, string>();

export const cookiesPrueba = {
  get: (nombre: string) => (valores.has(nombre) ? { name: nombre, value: valores.get(nombre)! } : undefined),
  set: (nombre: string, valor: string) => void valores.set(nombre, valor),
  delete: (nombre: string) => void valores.delete(nombre),
  has: (nombre: string) => valores.has(nombre),
  limpiar: () => valores.clear(),
};
