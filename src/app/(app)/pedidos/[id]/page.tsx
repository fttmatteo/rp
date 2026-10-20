import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, claseBoton, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { saldoCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { ESTADO_PEDIDO, esParcial } from "@/lib/estados";
import { formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos, hoyISO, nombreProducto } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { superaCupo } from "@/modules/cartera";
import { enlaceWhatsApp } from "@/modules/contacto";
import { mensajePedido, mensajeRecibo } from "@/modules/mensajes";
import { totalPedido } from "@/modules/precios";
import { textoDias } from "@/modules/recurrentes";
import { anularVenta, aprobarPedido, cancelarPedido, entregarPedido, marcarNoEntregado, reprogramarPedido } from "../acciones";

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  const sesion = await requerir("pedidos.ver");
  const id = Number((await params).id);
  const { creado } = await searchParams;
  const pedido = Number.isInteger(id)
    ? await db.pedido.findUnique({
        where: { id },
        include: {
          cliente: true,
          creadoPor: true,
          ruta: { include: { repartidor: true } },
          recurrente: true,
          detalles: { include: { producto: true }, orderBy: { id: "asc" } },
          venta: { include: { aplicaciones: { include: { pago: true } } } },
        },
      })
    : null;
  if (!pedido) notFound();

  const total = totalPedido(pedido.detalles);
  const saldo = await saldoCliente(pedido.clienteId);
  const op = sesion.operacion;
  const venta = pedido.venta;
  const pagado = venta ? venta.aplicaciones.filter((a) => !a.pago.anulado).reduce((s, a) => s + a.valor, 0) : 0;
  const entregado = pedido.estado === "ENTREGADO";
  const parcial = entregado && esParcial(pedido.detalles);
  // El repartidor solo entrega los pedidos de su propia ruta.
  const puedeEntregar = puede(op, "pedidos.entregar") && (op !== "REPARTIDOR" || pedido.ruta?.repartidorId === sesion.usuario.id);
  // Mensaje listo para WhatsApp: confirmación si está pendiente, recibo si ya se entregó.
  const whatsapp =
    pedido.estado === "PENDIENTE"
      ? enlaceWhatsApp(
          pedido.cliente.telefono,
          mensajePedido({
            cliente: pedido.cliente.nombre,
            fecha: formatoDia(pedido.fechaEntrega),
            lineas: pedido.detalles.map((d) => ({ cantidad: d.cantidad, producto: nombreProducto(d.producto) })),
            total,
          }),
        )
      : venta && !venta.anulada
        ? enlaceWhatsApp(
            pedido.cliente.telefono,
            mensajeRecibo({ cliente: pedido.cliente.nombre, numero: formatoConsecutivo("RP", venta.consecutivo), total: venta.total, pagado, saldoTotal: saldo }),
          )
        : null;

  return (
    <>
      <Titulo accion={<BotonLink href="/pedidos" variante="secundario">Volver</BotonLink>}>
        Pedido #{pedido.id}{" "}
        <Etiqueta color={ESTADO_PEDIDO[pedido.estado].color}>
          {ESTADO_PEDIDO[pedido.estado].texto}
          {parcial && " parcial"}
        </Etiqueta>
      </Titulo>
      {creado && (
        <div className="mb-4">
          <Alerta tipo="ok">
            Pedido creado. Queda pendiente hasta que se entregue.
            {pedido.recurrente && ` Se repetirá cada ${textoDias(pedido.recurrente.diasSemana)}: esos días se carga solo a Pedidos y el administrador lo aprueba.`}
          </Alerta>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Tarjeta>
          <p className="mb-1">
            <Link href={`/cartera/${pedido.clienteId}`} className="text-lg font-semibold underline">
              {pedido.cliente.nombre}
            </Link>
          </p>
          <p className="text-stone-600">
            {[pedido.cliente.direccion, pedido.cliente.zona, pedido.cliente.telefono].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2">
            Entrega: <strong>{formatoDia(pedido.fechaEntrega)}</strong> · Creado por {pedido.creadoPor.nombre} el{" "}
            {formatoFechaHora(pedido.creadoEn)}
          </p>
          {pedido.nota && <p className="mt-1 text-stone-600">Nota: {pedido.nota}</p>}
          {pedido.recurrente && (
            <p className="mt-1">
              Pedido recurrente:{" "}
              <Link href="/pedidos/recurrentes" className="underline">
                {pedido.recurrente.activo ? `se repite cada ${textoDias(pedido.recurrente.diasSemana)}` : "ya no se repite"}
              </Link>
            </p>
          )}
          {pedido.ruta && (
            <p className="mt-1">
              Ruta:{" "}
              {puede(op, "rutas") ? (
                <Link href={`/rutas/${pedido.ruta.id}`} className="underline">
                  {pedido.ruta.repartidor.nombre}
                </Link>
              ) : (
                pedido.ruta.repartidor.nombre
              )}
              {pedido.ordenEnRuta && ` · parada ${pedido.ordenEnRuta}`}
            </p>
          )}
          {pedido.motivoNoEntrega && <p className="mt-1 text-red-700">No se entregó: {pedido.motivoNoEntrega}</p>}
          {whatsapp && (
            // Es una acción: se ve y se toca como botón.
            <a href={whatsapp} target="_blank" rel="noreferrer" className={`${claseBoton("secundario")} mt-3`}>
              {pedido.estado === "PENDIENTE" ? "Confirmar el pedido por WhatsApp" : "Enviar el recibo por WhatsApp"}
            </a>
          )}
          <div className="mt-4">
            <Tabla>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Cant.</th>
                  {parcial && <th className="text-right">Entregado</th>}
                  <th className="text-right">Precio</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {pedido.detalles.map((d) => (
                  <tr key={d.id}>
                    <td>{nombreProducto(d.producto)}</td>
                    <td className="text-right">{d.cantidad}</td>
                    {parcial && <td className="text-right">{d.cantidadEntregada ?? d.cantidad}</td>}
                    <td className="text-right">{formatoPesos(d.precioUnitario)}</td>
                    <td className="text-right">{formatoPesos((entregado ? (d.cantidadEntregada ?? d.cantidad) : d.cantidad) * d.precioUnitario)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={parcial ? 4 : 3}>Total{parcial && " entregado"}</td>
                  <td className="text-right">{formatoPesos(venta ? venta.total : total)}</td>
                </tr>
              </tbody>
            </Tabla>
          </div>
        </Tarjeta>

        <div className="space-y-4">
          <Tarjeta id="cuenta" titulo="Cuenta del cliente">
            <p>
              Debe hoy: <strong className={saldo > 0 ? "text-red-700" : ""}>{formatoPesos(saldo)}</strong>
            </p>
            {pedido.estado === "PENDIENTE" && superaCupo(pedido.cliente.cupoCredito, saldo, total) && (
              <div className="mt-2">
                <Alerta tipo="aviso">Si este pedido se fía completo, el cliente supera su cupo de crédito.</Alerta>
              </div>
            )}
          </Tarjeta>

          {pedido.estado === "POR_APROBAR" && (
            <Tarjeta id="aprobar" titulo="Por aprobar">
              <p className="mb-3">Este pedido se cargó solo porque se repite cada semana. El repartidor lo podrá tomar cuando el administrador lo apruebe.</p>
              {puede(op, "pedidos.aprobar") && (
                <Formulario accion={aprobarPedido.bind(null, pedido.id)}>
                  <Boton type="submit">Aprobar pedido</Boton>
                </Formulario>
              )}
            </Tarjeta>
          )}

          {pedido.estado === "PENDIENTE" && puedeEntregar && (
            <Tarjeta id="entrega" titulo="Registrar entrega">
              <Formulario accion={entregarPedido.bind(null, pedido.id)}>
                <Campo
                  etiqueta="¿Cuánto pagó al recibir?"
                  ayuda={`Total ${formatoPesos(total)}. Escribe 0 si se fía todo; la diferencia queda como deuda. Si paga más, lo que sobra abona a sus deudas anteriores.`}
                >
                  <input name="pagado" inputMode="numeric" defaultValue={total} required />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
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
                <details>
                  <summary className="block cursor-pointer py-2.5 underline">Entrega parcial (no recibió todo)</summary>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {pedido.detalles.map((d) => (
                      <Campo key={d.id} etiqueta={`${nombreProducto(d.producto)} (pidió ${d.cantidad})`}>
                        <input name={`entregada_${d.id}`} inputMode="numeric" placeholder={String(d.cantidad)} />
                      </Campo>
                    ))}
                  </div>
                  <p className="mt-1 text-stone-500">Escribe solo lo que cambió. Se cobra lo entregado; ajusta también lo pagado.</p>
                </details>
                <Boton type="submit">Confirmar entrega</Boton>
              </Formulario>
              <details className="mt-4">
                <summary className="block cursor-pointer py-2.5 underline">No se pudo entregar</summary>
                <Formulario accion={marcarNoEntregado.bind(null, pedido.id)} className="mt-2 space-y-3">
                  <Campo etiqueta="Motivo">
                    <input name="motivo" required placeholder="Ej.: local cerrado, no lo recibió" />
                  </Campo>
                  <Boton type="submit" variante="peligro">
                    Marcar como no entregado
                  </Boton>
                </Formulario>
              </details>
            </Tarjeta>
          )}

          {pedido.estado === "NO_ENTREGADO" && puede(op, "pedidos.crear") && (
            <Tarjeta id="reprogramar" titulo="Reprogramar">
              <Formulario accion={reprogramarPedido.bind(null, pedido.id)} className="space-y-3">
                <Campo etiqueta="Nueva fecha de entrega" ayuda="Se crea un pedido nuevo con los mismos productos y precios.">
                  <input type="date" name="fechaEntrega" defaultValue={hoyISO()} min={hoyISO()} required />
                </Campo>
                <Boton type="submit">
                  Reprogramar pedido
                </Boton>
              </Formulario>
            </Tarjeta>
          )}

          {(pedido.estado === "PENDIENTE" || pedido.estado === "POR_APROBAR") && puede(op, "pedidos.crear") && (
            <Formulario accion={cancelarPedido.bind(null, pedido.id)} confirmar="¿Cancelar este pedido?">
              <Boton type="submit" variante="peligro">
                Cancelar pedido
              </Boton>
            </Formulario>
          )}

          {venta && (
            <Tarjeta id="venta" titulo="Venta">
              <p>
                Recibo{" "}
                <a href={`/recibos/venta/${venta.id}`} target="_blank" className="font-semibold underline">
                  {formatoConsecutivo("RP", venta.consecutivo)} (PDF)
                </a>{" "}
                {venta.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
              </p>
              <p>
                Pagado: {formatoPesos(pagado)} · Pendiente:{" "}
                <strong className={venta.saldo > 0 && !venta.anulada ? "text-red-700" : ""}>{formatoPesos(venta.saldo)}</strong>
              </p>
              {!venta.anulada && puede(op, "anular") && (
                <Formulario accion={anularVenta.bind(null, venta.id)} confirmar="¿Anular esta venta? La mercancía vuelve al inventario y la deuda se elimina." className="mt-3">
                  <Boton type="submit" variante="peligro">
                    Anular venta
                  </Boton>
                </Formulario>
              )}
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
