import { Formulario } from "@/components/formulario";
import { leerPagina } from "@/components/paginacion";
import { ElegirRegistro, ListaDinero, registroElegido, SelectorDiaCaja, type FilaDinero } from "@/components/dinero";
import { Alerta, Boton, Campo, Tarjeta, Titulo } from "@/components/ui";
import { obtenerCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { saldosProveedores } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";
import { PestanasContabilidad } from "@/components/secciones";
import { anularMovimientoCaja } from "../caja/acciones";
import { FormularioMovimiento } from "../caja/formulario-movimiento";
import { registrarPagoProveedor } from "./acciones";
import { FormularioCompra } from "./formulario-compra";
import { filaEgreso, incluirEgreso } from "./filas";
import { HistorialEgresos } from "./historial";

export default async function EgresosPage({ searchParams }: { searchParams: Promise<{ dia?: string; pagina?: string; registrar?: string; mes?: string; tipo?: string; concepto?: string }> }) {
  const sesion = await requerir("caja");
  const hoy = hoyISO();
  const { dia: diaParam, pagina: paginaParam, registrar, mes, tipo, concepto } = await searchParams;
  const pagina = leerPagina(paginaParam);
  const diaISO = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) && diaParam <= hoy ? diaParam : hoy;
  const dia = diaUTC(diaISO);
  const esHoy = diaISO === hoy;
  const verCompras = puede(sesion.operacion, "compras");

  const [caja, movimientos] = await Promise.all([
    obtenerCaja(dia, db, esHoy),
    db.movimientoCaja.findMany({
      where: { dia, tipo: "EGRESO" },
      orderBy: { fecha: "asc" },
      include: incluirEgreso,
    }),
  ]);
  const abierta = caja.estado === "ABIERTA";
  // Compras y pagos a proveedores siempre salen de la caja de hoy.
  const comprar = esHoy && abierta && verCompras;
  const [proveedores, tipos, saldos] = await Promise.all([
    comprar ? db.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }) : [],
    comprar ? db.producto.findMany({ where: { tipo: "CUBETA" }, orderBy: { orden: "asc" } }) : [],
    comprar ? saldosProveedores() : new Map<number, number>(),
  ]);
  const formularios = [
    ...(comprar ? [{ clave: "compra", texto: "Compra de huevo" }, { clave: "pago", texto: "Pago a proveedor" }] : []),
    ...(abierta ? [{ clave: "gasto", texto: "Gasto o retiro" }] : []),
  ];
  // El historial va como un botón más, para no repetirse debajo de cada formulario. Nunca se abre solo.
  const opciones = [...formularios, { clave: "historial", texto: "Historial de egresos" }];
  const elegido = registrar === "historial" ? "historial" : registroElegido(registrar, formularios);
  const porPagar = proveedores.filter((p) => (saldos.get(p.id) ?? 0) > 0);

  const filas: FilaDinero[] = movimientos.map((m) =>
    filaEgreso(
      m,
      abierta && !m.anulado && !m.rutaId && !m.compraId && !m.pagoProveedorId ? (
        <Formulario accion={anularMovimientoCaja.bind(null, m.id)} className="inline" confirmar="¿Anular este gasto?">
          <button type="submit" className="text-xs text-red-700 underline">
            Anular
          </button>
        </Formulario>
      ) : undefined,
    ),
  );

  return (
    <>
      <Titulo accion={<SelectorDiaCaja ruta="/egresos" diaISO={diaISO} />}>Egresos del {formatoDia(dia)}</Titulo>
      <PestanasContabilidad actual="/egresos" operacion={sesion.operacion} dia={diaISO} />
      <p className="mb-4 text-sm text-stone-600">Compras de huevo, pagos a proveedores y gastos.</p>
      {!abierta && (
        <div className="mb-4">
          <Alerta tipo="aviso">La caja de este día está cerrada. Para registrar algo, el administrador debe reabrirla.</Alerta>
        </div>
      )}

      <div className="mb-3">
        <ElegirRegistro ruta="/egresos" diaISO={diaISO} actual={elegido ?? ""} opciones={opciones} />
      </div>
      {elegido === "historial" ? (
        // El historial es una tabla ancha de cualquier mes: ocupa todo el ancho en lugar de los formularios y la lista del día.
        <HistorialEgresos
          operacion={sesion.operacion}
          diaISO={diaISO}
          mes={mes}
          tipo={tipo}
          concepto={concepto}
          pagina={pagina}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {elegido === "compra" && (
              <Tarjeta id="compra" titulo="Compra de huevo">
                <FormularioCompra proveedores={proveedores} tipos={tipos} />
              </Tarjeta>
            )}

            {elegido === "pago" && (
              <Tarjeta id="pago" titulo="Pago a proveedor">
                {porPagar.length === 0 ? (
                  <p className="text-sm text-stone-500">No le debemos a ningún proveedor.</p>
                ) : (
                  <Formulario accion={registrarPagoProveedor} className="space-y-3">
                    <Campo etiqueta="Proveedor" ayuda="Se aplica a la compra más antigua. Para pagar una compra en particular, hazlo desde Por pagar.">
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

            {elegido === "gasto" && (
              <Tarjeta id="gasto" titulo="Gasto o retiro">
                <FormularioMovimiento diaISO={diaISO} tipo="EGRESO" />
              </Tarjeta>
            )}
          </div>

          <ListaDinero id="lista" titulo="Salidas del día" filas={filas} ruta="/egresos" diaISO={diaISO} pagina={pagina} vacio="Sin egresos." />
        </div>
      )}
    </>
  );
}
