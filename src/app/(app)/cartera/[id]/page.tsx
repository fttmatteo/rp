import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion } from "@/components/paginacion";
import { Alerta, Boton, BotonLink, BotonTexto, Campo, claseBoton, Etiqueta, EtiquetaInactivo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { rangoAntiguedad, superaCupo } from "@/modules/cartera";
import { enlaceMaps, enlaceWhatsApp } from "@/modules/contacto";
import { mensajeEstadoCuenta } from "@/modules/mensajes";
import { deudasPendientes } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFecha, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { anularPago, registrarAbono, registrarSaldoInicial } from "../acciones";
import { anularVenta } from "../../pedidos/acciones";

const MOVIMIENTOS = 20;

/** Lo que el cliente debe y lo que ha pagado. Sus datos y precios se editan en Usuarios > Clientes. */
export default async function CarteraClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const sesion = await requerir("cartera.ver");
  const id = Number((await params).id);
  const { pagina: paginaParam } = await searchParams;
  const pagina = leerPagina(paginaParam);
  // Ventas y pagos van juntos por fecha: para la página N basta con las N páginas más recientes de cada uno.
  const hastaAqui = pagina * MOVIMIENTOS;
  const cliente = Number.isInteger(id)
    ? await db.cliente.findUnique({ where: { id } })
    : null;
  if (!cliente) notFound();

  const [deudas, ventas, pagos] = await Promise.all([
    deudasPendientes(id),
    db.venta.findMany({ where: { clienteId: id }, orderBy: [{ fecha: "desc" }, { id: "desc" }], take: hastaAqui }),
    db.pago.findMany({ where: { clienteId: id }, orderBy: [{ fecha: "desc" }, { id: "desc" }], take: hastaAqui }),
  ]);
  const [totalVentas, totalPagos] = await Promise.all([db.venta.count({ where: { clienteId: id } }), db.pago.count({ where: { clienteId: id } })]);
  const saldo = deudas.reduce((s, d) => s + d.saldo, 0);
  const hoy = diaUTC(hoyISO());
  const op = sesion.operacion;
  const whatsapp = enlaceWhatsApp(cliente.telefono);
  const estadoCuenta = enlaceWhatsApp(
    cliente.telefono,
    mensajeEstadoCuenta({
      cliente: cliente.nombre,
      deudas: deudas.map((d) => ({
        numero: formatoConsecutivo("RP", d.consecutivo),
        fecha: formatoFecha(d.fecha),
        saldo: d.saldo,
        vencida: d.vence < hoy,
      })),
    }),
  );
  const maps = enlaceMaps(cliente);

  const historial = [
    ...ventas.map((v) => ({ tipo: "venta" as const, fecha: v.fecha, v })),
    ...pagos.map((p) => ({ tipo: "pago" as const, fecha: p.fecha, p })),
  ]
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(hastaAqui - MOVIMIENTOS, hastaAqui);

  return (
    <>
      <Titulo
        accion={
          <div className="flex gap-2">
            {puede(op, "pedidos.crear") && <BotonLink href={`/pedidos/nuevo?cliente=${id}`}>Nuevo pedido</BotonLink>}
            <BotonLink href="/cartera" variante="secundario">
              Volver
            </BotonLink>
          </div>
        }
      >
        {cliente.nombre} {!cliente.activo && <EtiquetaInactivo />}
      </Titulo>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p>
          <span className="text-stone-600">Debe: </span>
          <span className={`text-2xl font-semibold tabular-nums ${saldo > 0 ? "text-red-700" : ""}`}>{formatoPesos(saldo)}</span>
        </p>
        {cliente.cupoCredito !== null && (
          <p className="text-stone-600">
            Cupo: {formatoPesos(cliente.cupoCredito)}{" "}
            {superaCupo(cliente.cupoCredito, saldo, 0) && <Etiqueta color="rojo">Supera el cupo</Etiqueta>}
          </p>
        )}
        {whatsapp && (
          <a className={`${claseBoton("secundario")} grow sm:grow-0`} href={whatsapp} target="_blank" rel="noreferrer">
            WhatsApp {cliente.telefono}
          </a>
        )}
        {estadoCuenta && (
          <a className={`${claseBoton("secundario")} grow sm:grow-0`} href={estadoCuenta} target="_blank" rel="noreferrer">
            Enviar estado de cuenta
          </a>
        )}
        {puede(op, "clientes.editar") && (
          <Link className={`${claseBoton("secundario")} grow sm:grow-0`} href={`/clientes/${id}`}>
            Editar datos del cliente
          </Link>
        )}
        {maps && (
          <a className={`${claseBoton("secundario")} grow sm:grow-0`} href={maps} target="_blank" rel="noreferrer">
            Ver en Maps
          </a>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
        <Tarjeta id="deudas" titulo="Deudas pendientes">
          {deudas.length === 0 ? (
            <p className="text-stone-500">No debe nada.</p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  {/* En el celular la fecha y el vencimiento bajan debajo del recibo. */}
                  <th>Recibo</th>
                  <th className="hidden sm:table-cell">Fecha</th>
                  <th className="hidden sm:table-cell">Vence</th>
                  <th>Días</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {deudas.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/recibos/venta/${d.id}`} className="underline" target="_blank">
                        {formatoConsecutivo("RP", d.consecutivo)}
                      </Link>
                      {d.tipo === "SALDO_INICIAL" && <span className="text-stone-500"> (saldo inicial)</span>}
                      <span className="block text-stone-600 sm:hidden">
                        {formatoFecha(d.fecha)} · vence {formatoDia(d.vence)}
                      </span>
                      {d.tipo === "SALDO_INICIAL" && d.saldo === d.total && puede(op, "anular") && (
                        <Formulario accion={anularVenta.bind(null, d.id)} className="inline" confirmar="¿Anular este saldo inicial?">
                          <BotonTexto type="submit" peligro>
                            Anular
                          </BotonTexto>
                        </Formulario>
                      )}
                    </td>
                    <td className="hidden sm:table-cell">{formatoFecha(d.fecha)}</td>
                    <td className="hidden sm:table-cell">{formatoDia(d.vence)}</td>
                    <td>
                      {rangoAntiguedad(d.fecha, hoy)}
                      {d.vence < hoy && (
                        <>
                          {" "}
                          <Etiqueta color="rojo">Vencida</Etiqueta>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatoPesos(d.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          {puede(op, "pagos.registrar") && op !== "REPARTIDOR" && saldo > 0 && (
            <Formulario accion={registrarAbono.bind(null, id)} className="mt-4 space-y-3">
              <h3 className="font-medium">Registrar abono</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo etiqueta="Valor">
                  <input name="valor" inputMode="numeric" required />
                </Campo>
                <Campo etiqueta="Medio">
                  <select name="medio" defaultValue="EFECTIVO">
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </Campo>
                <Campo etiqueta="Referencia">
                  <input name="referencia" placeholder="Si es transferencia" />
                </Campo>
              </div>
              <Campo
                etiqueta="Aplicar a"
                ayuda="Si el cliente paga un recibo en particular, elígelo. Si el abono es mayor que ese recibo, lo que sobra va a la deuda más antigua."
              >
                <select name="recibo" defaultValue="">
                  <option value="">La deuda más antigua primero</option>
                  {deudas.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.tipo === "SALDO_INICIAL" ? "Saldo inicial" : "Recibo"} {formatoConsecutivo("RP", d.consecutivo)} · {formatoFecha(d.fecha)} · debe{" "}
                      {formatoPesos(d.saldo)}
                    </option>
                  ))}
                </select>
              </Campo>
              <Boton type="submit">Registrar abono</Boton>
            </Formulario>
          )}
        </Tarjeta>


        {puede(op, "anular") && (
          <Tarjeta id="saldo-inicial" titulo="Saldo inicial">
            <Formulario accion={registrarSaldoInicial.bind(null, id)} className="space-y-3">
              <Alerta tipo="aviso">Úsalo solo para cargar lo que el cliente ya debía antes de usar la app.</Alerta>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Valor">
                  <input name="valor" inputMode="numeric" required />
                </Campo>
                <Campo etiqueta="Fecha de la deuda" ayuda="Desde esta fecha se cuentan los días de crédito para saber si está vencida.">
                  <input name="fecha" type="date" defaultValue={hoyISO()} max={hoyISO()} required />
                </Campo>
              </div>
              <Campo etiqueta="Nota">
                <input name="nota" />
              </Campo>
              <Boton type="submit" variante="secundario">
                Cargar saldo inicial
              </Boton>
            </Formulario>
          </Tarjeta>
        )}
        </div>
        <Tarjeta id="movimientos" titulo="Movimientos">
          {historial.length === 0 ? (
            <p className="text-stone-500">Sin compras ni pagos todavía.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {historial.map((h) =>
                h.tipo === "venta" ? (
                  <li key={`v${h.v.id}`} className="flex justify-between gap-2 py-2">
                    <span>
                      {formatoFecha(h.fecha)} ·{" "}
                      <Link href={`/recibos/venta/${h.v.id}`} target="_blank" className="underline">
                        {h.v.tipo === "SALDO_INICIAL" ? "Saldo inicial" : "Venta"} {formatoConsecutivo("RP", h.v.consecutivo)}
                      </Link>{" "}
                      {h.v.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">{formatoPesos(h.v.total)}</span>
                  </li>
                ) : (
                  <li key={`p${h.p.id}`} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {formatoFecha(h.fecha)} ·{" "}
                      <Link href={`/recibos/pago/${h.p.id}`} target="_blank" className="underline">
                        Pago {formatoConsecutivo("AB", h.p.consecutivo)}
                      </Link>{" "}
                      ({h.p.medio === "EFECTIVO" ? "efectivo" : "transferencia"}){" "}
                      {h.p.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-green-700 tabular-nums">−{formatoPesos(h.p.valor)}</span>
                      {puede(op, "anular") && !h.p.anulado && (
                        <Formulario accion={anularPago.bind(null, h.p.id)} confirmar="¿Anular este pago? Su valor vuelve a quedar como deuda." className="inline">
                          <BotonTexto type="submit" peligro>
                            Anular
                          </BotonTexto>
                        </Formulario>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
          <Paginacion ruta={`/cartera/${id}`} pagina={pagina} total={totalVentas + totalPagos} porPagina={MOVIMIENTOS} ancla="movimientos" />
        </Tarjeta>
      </div>
    </>
  );
}
