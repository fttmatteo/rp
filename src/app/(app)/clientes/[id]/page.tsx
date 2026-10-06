import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { rangoAntiguedad, superaCupo } from "@/modules/cartera";
import { enlaceMaps, enlaceWhatsApp } from "@/modules/contacto";
import { mensajeEstadoCuenta } from "@/modules/mensajes";
import { deudasPendientes } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFecha, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { anularPago, registrarAbono, registrarSaldoInicial } from "../../cartera/acciones";
import { anularVenta } from "../../pedidos/acciones";
import { actualizarCliente, guardarPreciosCliente } from "../acciones";
import { CamposCliente } from "../campos";

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  const sesion = await requerir("clientes.ver");
  const id = Number((await params).id);
  const { creado } = await searchParams;
  const cliente = Number.isInteger(id)
    ? await db.cliente.findUnique({ where: { id }, include: { precios: true } })
    : null;
  if (!cliente) notFound();

  const [productos, deudas, ventas, pagos] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    deudasPendientes(id),
    db.venta.findMany({ where: { clienteId: id }, orderBy: { fecha: "desc" }, take: 30 }),
    db.pago.findMany({ where: { clienteId: id }, orderBy: { fecha: "desc" }, take: 30 }),
  ]);
  const saldo = deudas.reduce((s, d) => s + d.saldo, 0);
  const hoy = diaUTC(hoyISO());
  const especiales = new Map(cliente.precios.map((p) => [p.productoId, p.precio]));
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
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <>
      <Titulo
        accion={
          <div className="flex gap-2">
            {puede(op, "pedidos.crear") && <BotonLink href={`/pedidos/nuevo?cliente=${id}`}>Nuevo pedido</BotonLink>}
            <BotonLink href="/clientes" variante="secundario">
              Volver
            </BotonLink>
          </div>
        }
      >
        {cliente.nombre} {!cliente.activo && <Etiqueta color="rojo">Inactivo</Etiqueta>}
      </Titulo>
      {creado && (
        <div className="mb-4">
          <Alerta tipo="ok">Cliente creado. Ya puedes tomarle pedidos o cargar su saldo inicial.</Alerta>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p>
          <span className="text-sm text-stone-600">Debe: </span>
          <span className={`text-2xl font-semibold ${saldo > 0 ? "text-red-700" : ""}`}>{formatoPesos(saldo)}</span>
        </p>
        {cliente.cupoCredito !== null && (
          <p className="text-sm text-stone-600">
            Cupo: {formatoPesos(cliente.cupoCredito)}{" "}
            {superaCupo(cliente.cupoCredito, saldo, 0) && <Etiqueta color="rojo">Supera el cupo</Etiqueta>}
          </p>
        )}
        {whatsapp && (
          <a className="text-sm underline" href={whatsapp} target="_blank" rel="noreferrer">
            WhatsApp {cliente.telefono}
          </a>
        )}
        {estadoCuenta && (
          <a className="text-sm underline" href={estadoCuenta} target="_blank" rel="noreferrer">
            Enviar estado de cuenta
          </a>
        )}
        {maps && (
          <a className="text-sm underline" href={maps} target="_blank" rel="noreferrer">
            Ver en Maps
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Deudas pendientes">
          {deudas.length === 0 ? (
            <p className="text-sm text-stone-500">No debe nada.</p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Fecha</th>
                  <th>Vence</th>
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
                      {d.tipo === "SALDO_INICIAL" && d.saldo === d.total && puede(op, "anular") && (
                        <Formulario accion={anularVenta.bind(null, d.id)} className="inline" confirmar="¿Anular este saldo inicial?">
                          <button type="submit" className="ml-2 text-xs text-red-700 underline">
                            Anular
                          </button>
                        </Formulario>
                      )}
                    </td>
                    <td>{formatoFecha(d.fecha)}</td>
                    <td>{formatoDia(d.vence)}</td>
                    <td>
                      {rangoAntiguedad(d.fecha, hoy)}
                      {d.vence < hoy && (
                        <>
                          {" "}
                          <Etiqueta color="rojo">Vencida</Etiqueta>
                        </>
                      )}
                    </td>
                    <td className="text-right">{formatoPesos(d.saldo)}</td>
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

        <Tarjeta titulo="Movimientos">
          {historial.length === 0 ? (
            <p className="text-sm text-stone-500">Sin compras ni pagos todavía.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
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
                    <span>{formatoPesos(h.v.total)}</span>
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
                      <span className="text-green-700">−{formatoPesos(h.p.valor)}</span>
                      {puede(op, "anular") && !h.p.anulado && (
                        <Formulario accion={anularPago.bind(null, h.p.id)} confirmar="¿Anular este pago? Su valor vuelve a quedar como deuda." className="inline">
                          <button type="submit" className="text-xs text-red-700 underline">
                            Anular
                          </button>
                        </Formulario>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Precios">
          {puede(op, "precios") ? (
            <Formulario accion={guardarPreciosCliente.bind(null, id)}>
              <Tabla>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>General</th>
                    <th>Especial</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{formatoPesos(p.precioGeneral)}</td>
                      <td>
                        <input
                          name={`precio_${p.id}`}
                          inputMode="numeric"
                          defaultValue={especiales.get(p.id) ?? ""}
                          placeholder={p.precioClienteSugerido ? `Sugerido ${p.precioClienteSugerido}` : "General"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
              <p className="text-xs text-stone-500">Vacío = paga el precio general.</p>
              <Boton type="submit">Guardar precios</Boton>
            </Formulario>
          ) : (
            <ul className="text-sm">
              {productos.map((p) => (
                <li key={p.id}>
                  {p.nombre}: {formatoPesos(especiales.get(p.id) ?? p.precioGeneral)}
                  {especiales.has(p.id) && " (especial)"}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Datos del cliente">
          {puede(op, "clientes.editar") ? (
            <Formulario accion={actualizarCliente.bind(null, id)}>
              <CamposCliente c={cliente} />
              <label className="flex items-center gap-2 font-normal">
                <input type="checkbox" name="activo" defaultChecked={cliente.activo} /> Cliente activo
              </label>
              <Boton type="submit">Guardar</Boton>
            </Formulario>
          ) : (
            <dl className="space-y-1 text-sm">
              <div>Dirección: {cliente.direccion ?? "—"}</div>
              <div>Zona: {cliente.zona ?? "—"}</div>
              <div>Notas: {cliente.notas ?? "—"}</div>
            </dl>
          )}
        </Tarjeta>

        {puede(op, "anular") && (
          <Tarjeta titulo="Saldo inicial">
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
      <p className="mt-6 text-xs text-stone-500">Cliente desde {formatoFecha(cliente.creadoEn)}</p>
    </>
  );
}
