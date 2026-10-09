import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { leerPagina } from "@/components/paginacion";
import { ElegirRegistro, ListaDinero, registroElegido, SelectorDiaCaja, type FilaDinero } from "@/components/dinero";
import { Alerta, Boton, BotonTexto, Campo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { obtenerCaja } from "@/lib/caja-db";
import { saldosPorCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoPesos, hoyISO, nombreProducto } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { PestanasContabilidad } from "@/components/secciones";
import { anularMovimientoCaja } from "../caja/acciones";
import { FormularioMovimiento } from "../caja/formulario-movimiento";
import { registrarAbonoCliente, registrarVentaDirecta } from "./acciones";
import { filaIngreso, filaPago, incluirPago } from "./filas";
import { HistorialIngresos } from "./historial";


export default async function IngresosPage({ searchParams }: { searchParams: Promise<{ dia?: string; pagina?: string; registrar?: string; mes?: string; tipo?: string }> }) {
  const sesion = await requerir("caja");
  const op = sesion.operacion;
  const hoy = hoyISO();
  const { dia: diaParam, pagina: paginaParam, registrar, mes, tipo } = await searchParams;
  const pagina = leerPagina(paginaParam);
  const diaISO = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) && diaParam <= hoy ? diaParam : hoy;
  const dia = diaUTC(diaISO);
  const esHoy = diaISO === hoy;

  const [caja, pagos, movimientos] = await Promise.all([
    obtenerCaja(dia, db, esHoy),
    db.pago.findMany({
      where: { dia },
      orderBy: { fecha: "asc" },
      include: incluirPago,
    }),
    db.movimientoCaja.findMany({ where: { dia, tipo: "INGRESO" }, orderBy: { fecha: "asc" }, include: { usuario: { select: { nombre: true } } } }),
  ]);
  const abierta = caja.estado === "ABIERTA";
  const vender = esHoy && abierta && puede(op, "pedidos.crear") && puede(op, "pedidos.entregar");
  const abonar = esHoy && abierta && puede(op, "pagos.registrar") && op !== "REPARTIDOR";
  const [clientes, productos, saldos] = await Promise.all([
    vender || abonar ? db.cliente.findMany({ where: { activo: true, consumidorFinal: false }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }) : [],
    vender ? db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }) : [],
    abonar ? saldosPorCliente() : new Map<number, number>(),
  ]);
  const formularios = [
    ...(vender ? [{ clave: "venta", texto: "Venta en el punto" }] : []),
    ...(abonar ? [{ clave: "abono", texto: "Abono de cliente" }] : []),
    ...(abierta ? [{ clave: "otro", texto: "Otro ingreso" }] : []),
  ];
  // El historial va como un botón más, como en Egresos. Nunca se abre solo.
  const opciones = [...formularios, { clave: "historial", texto: "Historial de ingresos" }];
  const elegido = registrar === "historial" ? "historial" : registroElegido(registrar, formularios);
  const deudores = clientes.filter((c) => (saldos.get(c.id) ?? 0) > 0);

  const filas: FilaDinero[] = [
    ...pagos.map(filaPago),
    ...movimientos.map((m) =>
      filaIngreso(
        m,
        abierta && !m.anulado && !m.rutaId ? (
          <Formulario accion={anularMovimientoCaja.bind(null, m.id)} className="inline" confirmar="¿Anular este ingreso?">
            <BotonTexto type="submit" peligro>
              Anular
            </BotonTexto>
          </Formulario>
        ) : undefined,
      ),
    ),
  ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  return (
    <>
      <Titulo accion={<SelectorDiaCaja ruta="/ingresos" diaISO={diaISO} />}>Ingresos del {formatoDia(dia)}</Titulo>
      <PestanasContabilidad actual="/ingresos" operacion={op} dia={diaISO} />
      <p className="mb-4 text-stone-600">
        Ventas, abonos de clientes y otros ingresos. Los cobros de los repartidores llegan solos desde{" "}
        <Link href="/rutas" className="underline">
          Rutas
        </Link>
        .
      </p>
      {!abierta && (
        <div className="mb-4">
          <Alerta tipo="aviso">La caja de este día está cerrada. Para registrar algo, el administrador debe reabrirla.</Alerta>
        </div>
      )}

      <div className="mb-3">
        <ElegirRegistro ruta="/ingresos" diaISO={diaISO} actual={elegido ?? ""} opciones={opciones} />
      </div>
      {elegido === "historial" ? (
        <HistorialIngresos diaISO={diaISO} mes={mes} tipo={tipo} pagina={pagina} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {elegido === "venta" && (
              <Tarjeta id="venta" titulo="Venta en el punto">
                <Formulario accion={registrarVentaDirecta} className="space-y-3">
                  <p className="text-sm text-stone-500">
                    Para el cliente que se lleva el producto ahora: queda entregada con su recibo. Los pedidos para repartir se crean en{" "}
                    <Link href="/pedidos/nuevo" className="underline">
                      Pedidos
                    </Link>
                    .
                  </p>
                  <Campo etiqueta="Cliente" ayuda="Consumidor final: alguien que compra una vez y no está registrado. Paga todo en el momento.">
                    <select name="clienteId" required defaultValue="final">
                      <option value="final">Consumidor final (no registrado)</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Tabla>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio general</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id}>
                          <td className="font-medium">{nombreProducto(p)}</td>
                          <td>{formatoPesos(p.precioGeneral)}</td>
                          <td>
                            <input name={`cantidad_${p.id}`} inputMode="numeric" placeholder="0" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabla>
                  <p className="text-sm text-stone-500">Si el cliente tiene precio especial, se usa ese.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Valor pagado" ayuda="Vacío = paga todo. 0 = queda fiado.">
                      <input name="pagado" inputMode="numeric" />
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
                  <Boton type="submit">Registrar venta</Boton>
                </Formulario>
              </Tarjeta>
            )}

            {elegido === "abono" && (
              <Tarjeta id="abono" titulo="Abono de cliente">
                {deudores.length === 0 ? (
                  <p className="text-stone-500">Ningún cliente debe dinero.</p>
                ) : (
                  <Formulario accion={registrarAbonoCliente} className="space-y-3">
                    <Campo etiqueta="Cliente" ayuda="Se aplica a la deuda más antigua. Para abonar a un recibo en particular, hazlo desde la cartera del cliente.">
                      <select name="clienteId" required defaultValue="">
                        <option value="" disabled>
                          Elige el cliente
                        </option>
                        {deudores.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} · debe {formatoPesos(saldos.get(c.id) ?? 0)}
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
                    <Boton type="submit">Registrar abono</Boton>
                  </Formulario>
                )}
              </Tarjeta>
            )}

            {elegido === "otro" && (
              <Tarjeta id="otro" titulo="Otro ingreso">
                <FormularioMovimiento diaISO={diaISO} tipo="INGRESO" />
              </Tarjeta>
            )}
          </div>

          <ListaDinero id="lista" titulo="Entradas del día" filas={filas} ruta="/ingresos" diaISO={diaISO} pagina={pagina} vacio="Sin ingresos." />
        </div>
      )}
    </>
  );
}
