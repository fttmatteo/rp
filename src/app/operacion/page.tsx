import { Formulario } from "@/components/formulario";
import { Boton } from "@/components/ui";
import { ETIQUETA_OPERACION, OPERACIONES, tieneAcceso } from "@/lib/permisos";
import { requerirSesion } from "@/lib/sesion";
import { salir } from "../login/acciones";
import { seleccionarOperacion } from "./acciones";

const DESCRIPCION = {
  ADMIN: "Todo: usuarios, precios, inventario (clasificación y aves), ventas y cartera.",
  VENTAS: "Clientes, pedidos, rutas, ventas, cobros, cartera, caja, compras y reportes.",
  REPARTIDOR: "Tu ruta del día: entregas, cobros y saldo de los clientes.",
} as const;

export default async function OperacionPage() {
  const sesion = await requerirSesion();
  return (
    <main className="mx-auto mt-12 max-w-md px-4">
      <h1 className="text-xl font-semibold">Hola, {sesion.usuario.nombre}</h1>
      <p className="mb-6 text-stone-600">¿Qué operación vas a hacer?</p>
      <Formulario accion={seleccionarOperacion} className="space-y-3">
        {/* Solo las que el administrador le asignó: así nadie toca una que le niega el acceso. */}
        {OPERACIONES.filter((op) => tieneAcceso(sesion.usuario.accesos, op)).map((op) => (
          <button
            key={op}
            name="operacion"
            value={op}
            type="submit"
            className="block w-full rounded border border-stone-300 bg-white px-4 py-3 text-left hover:bg-stone-100"
          >
            <span className="block font-medium">{ETIQUETA_OPERACION[op]}</span>
            <span className="block text-stone-600">{DESCRIPCION[op]}</span>
          </button>
        ))}
      </Formulario>
      <form action={salir} className="mt-6">
        <Boton variante="secundario" type="submit">
          Salir
        </Boton>
      </form>
    </main>
  );
}
