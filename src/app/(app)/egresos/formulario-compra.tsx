import type { Producto, Proveedor } from "@prisma/client";
import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, Campo, Tabla } from "@/components/ui";
import { registrarCompra } from "./compras";

/** Formulario de compra de huevo a un proveedor (se usa en Egresos). */
export function FormularioCompra({ proveedores, tipos }: { proveedores: Proveedor[]; tipos: Producto[] }) {
  if (proveedores.length === 0)
    return (
      <p className="text-stone-600">
        Primero crea el proveedor en{" "}
        <Link href="/proveedores" className="underline">
          Proveedores
        </Link>
        .
      </p>
    );
  return (
    <Formulario accion={registrarCompra}>
      <Campo etiqueta="Proveedor">
        <select name="proveedorId" required>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <fieldset className="space-y-2">
        <legend className="font-medium text-stone-700">¿Cómo llegó el huevo?</legend>
        <label className="flex items-center gap-2 font-normal">
          <input type="radio" name="ingreso" value="CLASIFICADA" defaultChecked /> Ya clasificado: suma directo al inventario por
          tipo
        </label>
        <label className="flex items-center gap-2 font-normal">
          <input type="radio" name="ingreso" value="SIN_CLASIFICAR" /> Sin clasificar: queda por clasificar en Clasificación
        </label>
      </fieldset>

      <details open className="rounded border border-stone-200 p-3">
        <summary className="block cursor-pointer py-2.5 font-medium">Si llegó clasificado: cantidad por tipo</summary>
        <Tabla>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Cubetas</th>
              <th>Huevos sueltos</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.nombre}</td>
                <td>
                  <input name={`cubetas_${p.id}`} inputMode="numeric" placeholder="0" />
                </td>
                <td>
                  <input name={`sueltos_${p.id}`} inputMode="numeric" placeholder="0" />
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </details>
      <details className="rounded border border-stone-200 p-3">
        <summary className="block cursor-pointer py-2.5 font-medium">Si llegó sin clasificar: cantidad total</summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Campo etiqueta="Cubetas">
            <input name="cubetas" inputMode="numeric" placeholder="0" />
          </Campo>
          <Campo etiqueta="Huevos sueltos">
            <input name="sueltos" inputMode="numeric" placeholder="0" />
          </Campo>
        </div>
      </details>

      <Campo etiqueta="Costo total" ayuda="Lo que se le paga al proveedor por toda la compra.">
        <input name="total" inputMode="numeric" required />
      </Campo>
      <fieldset className="space-y-2">
        <legend className="font-medium text-stone-700">Pago al proveedor</legend>
        <label className="flex items-center gap-2 font-normal">
          <input type="radio" name="formaPago" value="CONTADO" defaultChecked /> De contado: sale de la caja de hoy
        </label>
        <label className="flex items-center gap-2 font-normal">
          <input type="radio" name="formaPago" value="CREDITO" /> A crédito: queda como cuenta por pagar
        </label>
      </fieldset>
      <Campo etiqueta="Medio (si es de contado)">
        <select name="medio" defaultValue="EFECTIVO">
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
        </select>
      </Campo>
      <Campo etiqueta="Nota">
        <input name="nota" />
      </Campo>
      <Boton type="submit">Registrar compra</Boton>
    </Formulario>
  );
}
