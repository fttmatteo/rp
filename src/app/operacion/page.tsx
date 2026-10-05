import { Formulario } from "@/components/formulario";
import { Boton } from "@/components/ui";
import { ETIQUETA_OPERACION, OPERACIONES } from "@/lib/permisos";
import { requerirSesion } from "@/lib/sesion";
import { salir } from "../login/acciones";
import { seleccionarOperacion } from "./acciones";

const DESCRIPCION = {
  ADMIN: "Todo: usuarios, precios, inventario, ventas y cartera.",
  VENTAS: "Clientes, pedidos, rutas, ventas, cobros, caja e inventario.",
  REPARTIDOR: "Tu ruta del día: entregas, cobros y saldo de los clientes.",
  GALPONERO: "Aves, novedades de los lotes, clasificación diaria e inventario.",
} as const;

export default async function OperacionPage() {
  const sesion = await requerirSesion();
  return (
    <main className="mx-auto mt-12 max-w-md px-4">
      <h1 className="text-xl font-semibold">Hola, {sesion.usuario.nombre}</h1>
      <p className="mb-6 text-sm text-stone-600">¿Qué operación vas a hacer?</p>
      <Formulario accion={seleccionarOperacion} className="space-y-3">
        {OPERACIONES.map((op) => (
          <button
            key={op}
            name="operacion"
            value={op}
            type="submit"
            className="block w-full rounded border border-stone-300 bg-white px-4 py-3 text-left hover:bg-stone-100"
          >
            <span className="block font-medium">{ETIQUETA_OPERACION[op]}</span>
            <span className="block text-sm text-stone-600">{DESCRIPCION[op]}</span>
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
