import { Formulario } from "@/components/formulario";
import { Boton, Campo } from "@/components/ui";
import { registrarMovimientoCaja } from "./acciones";

/** Otro ingreso o gasto suelto de la caja de un día (lo que no es venta, abono, compra ni pago a proveedor). */
export function FormularioMovimiento({ diaISO, tipo }: { diaISO: string; tipo: "INGRESO" | "EGRESO" }) {
  const ingreso = tipo === "INGRESO";
  return (
    <Formulario accion={registrarMovimientoCaja.bind(null, diaISO)} className="space-y-3">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Valor">
          <input name="valor" inputMode="numeric" required />
        </Campo>
        <Campo etiqueta="Medio">
          <select name="medio" defaultValue="EFECTIVO">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </Campo>
      </div>
      <Campo
        etiqueta="Concepto"
        ayuda={
          ingreso
            ? "Solo dinero que no viene de una venta ni de un abono de cliente: esos se registran arriba para que bajen la deuda y el inventario."
            : "Solo gastos que no son compras de huevo ni pagos a proveedores: esos se registran arriba para que suban el inventario y bajen la cuenta por pagar."
        }
      >
        <input name="concepto" required placeholder={ingreso ? "Ej.: préstamo, aporte del dueño" : "Ej.: gasolina, cubetas vacías, consignación"} />
      </Campo>
      <Boton type="submit" variante="secundario">
        {ingreso ? "Registrar ingreso" : "Registrar gasto"}
      </Boton>
    </Formulario>
  );
}
