import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { ListaDinero, SelectorDiaCaja, type FilaDinero } from "@/components/dinero";
import { Alerta, Boton, BotonLink, Campo, Subnav, Tarjeta, Titulo } from "@/components/ui";
import { obtenerCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { saldosProveedores } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";
import { anularMovimientoCaja } from "../caja/acciones";
import { FormularioMovimiento } from "../caja/formulario-movimiento";
import { FormularioCompra } from "../compras/formulario-compra";
import { registrarPagoProveedor } from "./acciones";

export default async function EgresosPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sesion = await requerir("caja");
  const hoy = hoyISO();
  const { dia: diaParam } = await searchParams;
  const diaISO = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) && diaParam <= hoy ? diaParam : hoy;
  const dia = diaUTC(diaISO);
  const esHoy = diaISO === hoy;

  const [caja, movimientos] = await Promise.all([
    obtenerCaja(dia, db, esHoy),
    db.movimientoCaja.findMany({
      where: { dia, tipo: "EGRESO" },
      orderBy: { fecha: "asc" },
      include: {
        usuario: { select: { nombre: true } },
        compra: { select: { id: true, proveedorId: true } },
        pagoProveedor: { select: { proveedorId: true } },
      },
    }),
  ]);
  const abierta = caja.estado === "ABIERTA";
  // Compras y pagos a proveedores siempre salen de la caja de hoy.
  const comprar = esHoy && abierta && puede(sesion.operacion, "compras");
  const [proveedores, tipos, saldos] = await Promise.all([
    comprar ? db.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }) : [],
    comprar ? db.producto.findMany({ where: { tipo: "CUBETA" }, orderBy: { orden: "asc" } }) : [],
    comprar ? saldosProveedores() : new Map<number, number>(),
  ]);
  const porPagar = proveedores.filter((p) => (saldos.get(p.id) ?? 0) > 0);

  const filas: FilaDinero[] = movimientos.map((m) => {
    const proveedorId = m.compra?.proveedorId ?? m.pagoProveedor?.proveedorId;
    return {
      clave: `m${m.id}`,
      fecha: m.fecha,
      origen: m.compraId ? "Compra" : m.pagoProveedorId ? "Pago a proveedor" : m.rutaId ? "Faltante de ruta" : "Gasto",
      detalle: proveedorId ? (
        <Link href={`/proveedores/${proveedorId}`} className="underline">
          {m.concepto}
        </Link>
      ) : (
        m.concepto
      ),
      medio: m.medio,
      usuario: m.usuario.nombre,
      valor: m.valor,
      anulado: m.anulado,
      anular:
        abierta && !m.anulado && !m.rutaId && !m.compraId && !m.pagoProveedorId ? (
          <Formulario accion={anularMovimientoCaja.bind(null, m.id)} className="inline" confirmar="¿Anular este gasto?">
            <button type="submit" className="text-xs text-red-700 underline">
              Anular
            </button>
          </Formulario>
        ) : undefined,
    };
  });

  return (
    <>
      <Titulo accion={<BotonLink href={`/caja?dia=${diaISO}`} variante="secundario">Caja y cierre</BotonLink>}>
        Egresos del {formatoDia(dia)}
      </Titulo>
      <p className="mb-4 text-sm text-stone-600">
        Todo el dinero que sale se registra aquí: compras de huevo, pagos a proveedores y gastos. Las compras anteriores están en{" "}
        <Link href="/compras" className="underline">
          Compras
        </Link>
        .
      </p>
      <SelectorDiaCaja ruta="/egresos" diaISO={diaISO} />
      <Subnav
        enlaces={[
          comprar && { id: "compra", texto: "Compra" },
          comprar && { id: "pago", texto: "Pago a proveedor" },
          abierta && { id: "gasto", texto: "Gasto" },
          { id: "lista", texto: `Salidas del día (${filas.filter((f) => !f.anulado).length})` },
        ]}
      />
      {!abierta && (
        <div className="mb-4">
          <Alerta tipo="aviso">La caja de este día está cerrada. Para registrar algo, el administrador debe reabrirla.</Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {comprar && (
            <Tarjeta id="compra" titulo="Compra de huevo">
              <FormularioCompra proveedores={proveedores} tipos={tipos} />
            </Tarjeta>
          )}

          {comprar && (
            <Tarjeta id="pago" titulo="Pago a proveedor">
              {porPagar.length === 0 ? (
                <p className="text-sm text-stone-500">No le debemos a ningún proveedor.</p>
              ) : (
                <Formulario accion={registrarPagoProveedor} className="space-y-3">
                  <Campo etiqueta="Proveedor" ayuda="Se aplica a la compra más antigua. Para pagar una compra en particular, hazlo desde la ficha del proveedor.">
                    <select name="proveedorId" required defaultValue="">
                      <option value="" disabled>
                        Elige el proveedor
                      </option>
                      {porPagar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} · le debemos {formatoPesos(saldos.get(p.id) ?? 0)}
                        </option>
                      ))}
                    </select>
                  </Campo>
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
                  <Campo etiqueta="Referencia">
                    <input name="referencia" placeholder="Si es transferencia" />
                  </Campo>
                  <Boton type="submit">Registrar pago</Boton>
                </Formulario>
              )}
            </Tarjeta>
          )}

          {abierta && (
            <Tarjeta id="gasto" titulo="Gasto o retiro">
              <FormularioMovimiento diaISO={diaISO} tipo="EGRESO" />
            </Tarjeta>
          )}
        </div>

        <ListaDinero id="lista" titulo="Salidas del día" filas={filas} vacio="Sin egresos." />
      </div>
    </>
  );
}
