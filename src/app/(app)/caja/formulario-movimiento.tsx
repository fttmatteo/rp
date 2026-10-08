import { Formulario } from "@/components/formulario";
import { Boton, Campo } from "@/components/ui";
import { CONCEPTOS_GASTO, OTRO_GASTO } from "@/modules/gastos";
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
      {ingreso ? (
        <Campo
          etiqueta="Concepto"
          ayuda="Solo dinero que no viene de una venta ni de un abono de cliente: esos se registran arriba para que bajen la deuda y el inventario."
        >
          <input name="concepto" required placeholder="Ej.: préstamo, aporte del dueño" />
        </Campo>
      ) : (
        // El concepto escrito solo se muestra al elegir Otro (sin JavaScript, con :has).
        <div className="group space-y-3">
          <Campo
            etiqueta="Gasto"
            ayuda="Solo gastos que no son compras de huevo ni pagos a proveedores: esos se registran arriba para que suban el inventario y bajen la cuenta por pagar."
          >
            <select name="gasto" required defaultValue="">
              <option value="" disabled>
                Elige el gasto
              </option>
              {CONCEPTOS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={OTRO_GASTO} className="otro">
                Otro (escribir el concepto)
              </option>
            </select>
          </Campo>
          <div className="hidden group-has-[.otro:checked]:block">
            <Campo etiqueta="Concepto">
              <input name="concepto" placeholder="Ej.: retiro del dueño, consignación" />
            </Campo>
          </div>
        </div>
      )}
      <Boton type="submit" variante="secundario">
        {ingreso ? "Registrar ingreso" : "Registrar gasto"}
      </Boton>
    </Formulario>
  );
}
