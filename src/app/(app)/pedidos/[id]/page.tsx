import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { saldoCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { superaCupo } from "@/modules/cartera";
import { totalPedido } from "@/modules/precios";
import { anularVenta, cancelarPedido, entregarPedido } from "../acciones";

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
          detalles: { include: { producto: true } },
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

  return (
    <>
      <Titulo accion={<BotonLink href="/pedidos" variante="secundario">Volver</BotonLink>}>
        Pedido #{pedido.id}{" "}
        <Etiqueta color={pedido.estado === "PENDIENTE" ? "ambar" : pedido.estado === "ENTREGADO" ? "verde" : "gris"}>
          {pedido.estado === "PENDIENTE" ? "Pendiente" : pedido.estado === "ENTREGADO" ? "Entregado" : "Cancelado"}
        </Etiqueta>
      </Titulo>
      {creado && (
        <div className="mb-4">
          <Alerta tipo="ok">Pedido creado. Queda pendiente hasta que se entregue.</Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <p className="mb-1">
            <Link href={`/clientes/${pedido.clienteId}`} className="text-lg font-semibold underline">
              {pedido.cliente.nombre}
            </Link>
          </p>
          <p className="text-sm text-stone-600">
            {[pedido.cliente.direccion, pedido.cliente.zona, pedido.cliente.telefono].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-sm">
            Entrega: <strong>{formatoDia(pedido.fechaEntrega)}</strong> · Creado por {pedido.creadoPor.nombre} el{" "}
            {formatoFechaHora(pedido.creadoEn)}
          </p>
          {pedido.nota && <p className="mt-1 text-sm text-stone-600">Nota: {pedido.nota}</p>}
          <div className="mt-4">
            <Tabla>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Precio</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {pedido.detalles.map((d) => (
                  <tr key={d.id}>
                    <td>{d.producto.tipo === "CUBETA" ? `Cubeta ${d.producto.nombre}` : d.producto.nombre}</td>
                    <td className="text-right">{d.cantidad}</td>
                    <td className="text-right">{formatoPesos(d.precioUnitario)}</td>
                    <td className="text-right">{formatoPesos(d.cantidad * d.precioUnitario)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={3}>Total</td>
                  <td className="text-right">{formatoPesos(total)}</td>
                </tr>
              </tbody>
            </Tabla>
          </div>
        </Tarjeta>

        <div className="space-y-4">
          <Tarjeta titulo="Cuenta del cliente">
            <p>
              Debe hoy: <strong className={saldo > 0 ? "text-red-700" : ""}>{formatoPesos(saldo)}</strong>
            </p>
            {pedido.estado === "PENDIENTE" && superaCupo(pedido.cliente.cupoCredito, saldo, total) && (
              <div className="mt-2">
                <Alerta tipo="aviso">Si este pedido se fía completo, el cliente supera su cupo de crédito.</Alerta>
              </div>
            )}
          </Tarjeta>

          {pedido.estado === "PENDIENTE" && puede(op, "pedidos.entregar") && (
            <Tarjeta titulo="Registrar entrega">
              <Formulario accion={entregarPedido.bind(null, pedido.id)}>
                <Campo etiqueta="¿Cuánto pagó al recibir?" ayuda={`Total ${formatoPesos(total)}. Escribe 0 si se fía todo; la diferencia queda como deuda.`}>
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
                <Boton type="submit">Confirmar entrega</Boton>
              </Formulario>
            </Tarjeta>
          )}

          {pedido.estado === "PENDIENTE" && puede(op, "pedidos.crear") && (
            <Formulario accion={cancelarPedido.bind(null, pedido.id)} confirmar="¿Cancelar este pedido?">
              <Boton type="submit" variante="peligro">
                Cancelar pedido
              </Boton>
            </Formulario>
          )}

          {venta && (
            <Tarjeta titulo="Venta">
              <p>
                Recibo{" "}
                <a href={`/recibos/venta/${venta.id}`} target="_blank" className="font-semibold underline">
                  {formatoConsecutivo("RP", venta.consecutivo)} (PDF)
                </a>{" "}
                {venta.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
              </p>
              <p className="text-sm">
                Pagado: {formatoPesos(pagado)} · Pendiente: {formatoPesos(venta.saldo)}
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
