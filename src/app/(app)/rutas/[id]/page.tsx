import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { ESTADO_PEDIDO, esParcial } from "@/lib/estados";
import { formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { datosRuta } from "@/lib/rutas-datos";
import { requerir } from "@/lib/sesion";
import { guardarOrden, liquidarRuta, ordenarRutaPorZona, quitarDeRuta, reabrirRuta } from "../acciones";

function Fila({ texto, valor, fuerte, rojo }: { texto: string; valor: number; fuerte?: boolean; rojo?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1 ${fuerte ? "border-t border-stone-200 pt-2 font-semibold" : ""} ${rojo && valor ? "text-red-700" : ""}`}
    >
      <span>{texto}</span>
      <span>{formatoPesos(valor)}</span>
    </div>
  );
}

export default async function RutaPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerir("rutas");
  const id = Number((await params).id);
  const datos = Number.isInteger(id) ? await datosRuta(id) : null;
  if (!datos) notFound();
  const { ruta, filas, cierre, liquidacion, pagos } = datos;
  const abierta = ruta.estado === "ABIERTA";
  const pendientes = filas.filter((f) => f.pedido.estado === "PENDIENTE").length;
  const fecha = ruta.fecha.toISOString().slice(0, 10);
  const nombres = new Map(filas.flatMap((f) => f.pedido.detalles.map((d) => [d.productoId, d.producto] as const)));
  const porProducto = [...cierre.porProducto].sort(
    (a, b) => (nombres.get(a.productoId)?.orden ?? 0) - (nombres.get(b.productoId)?.orden ?? 0),
  );

  return (
    <>
      <Titulo
        accion={
          <BotonLink href={`/rutas?fecha=${fecha}`} variante="secundario">
            Volver
          </BotonLink>
        }
      >
        Ruta de {ruta.repartidor.nombre} · {formatoDia(ruta.fecha)}{" "}
        <Etiqueta color={abierta ? "ambar" : "verde"}>{abierta ? "Abierta" : "Liquidada"}</Etiqueta>
      </Titulo>
      <p className="mb-4 text-sm text-stone-600">
        {filas.length} paradas · {cierre.entregados} entregadas · {pendientes} por entregar · {cierre.noEntregados} no entregadas
      </p>

      {abierta && filas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Formulario accion={ordenarRutaPorZona.bind(null, ruta.id)} className="inline">
            <Boton type="submit" variante="secundario">
              Ordenar por zona
            </Boton>
          </Formulario>
          <Formulario accion={guardarOrden.bind(null, ruta.id)} id="orden" className="inline">
            <Boton type="submit" variante="secundario">
              Guardar orden escrito
            </Boton>
          </Formulario>
        </div>
      )}

      {filas.length === 0 ? (
        <Alerta tipo="aviso">La ruta no tiene paradas. Asígnale pedidos desde Rutas.</Alerta>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th className="text-right">Valor</th>
              <th className="text-right">Pagado</th>
              <th className="text-right">Pendiente</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ pedido: p, reparto, valores }) => (
              <tr key={p.id}>
                <td className="w-20">
                  {abierta ? (
                    <input
                      form="orden"
                      name={`orden_${p.id}`}
                      inputMode="numeric"
                      defaultValue={p.ordenEnRuta ?? ""}
                      aria-label={`Orden de ${p.cliente.nombre}`}
                    />
                  ) : (
                    p.ordenEnRuta
                  )}
                </td>
                <td>
                  <Link href={`/pedidos/${p.id}`} className="underline">
                    {p.cliente.nombre}
                  </Link>
                  <span className="block text-xs text-stone-500">{[p.cliente.zona, p.cliente.direccion].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="text-stone-600">
                  {p.detalles.map((d) => `${d.cantidadEntregada ?? d.cantidad} ${d.producto.nombre}`).join(", ")}
                </td>
                <td className="text-right">{formatoPesos(valores.valor)}</td>
                <td className="text-right">{reparto.entregado ? formatoPesos(valores.pagado) : "–"}</td>
                <td className={`text-right ${valores.pendiente > 0 ? "text-red-700" : ""}`}>
                  {reparto.entregado ? formatoPesos(valores.pendiente) : "–"}
                </td>
                <td>
                  <Etiqueta color={ESTADO_PEDIDO[p.estado].color}>
                    {ESTADO_PEDIDO[p.estado].texto}
                    {p.estado === "ENTREGADO" && esParcial(p.detalles) && " parcial"}
                  </Etiqueta>
                  {p.motivoNoEntrega && <span className="block text-xs text-stone-500">{p.motivoNoEntrega}</span>}
                  {abierta && p.estado === "PENDIENTE" && (
                    <Formulario accion={quitarDeRuta.bind(null, p.id)} className="inline">
                      <button type="submit" className="ml-1 text-xs text-red-700 underline">
                        Quitar
                      </button>
                    </Formulario>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      {abierta && filas.length > 0 && (
        <p className="mt-2 text-xs text-stone-500">
          Para cambiar el orden escribe el número de parada (por ejemplo, 1 para que vaya de primera) y pulsa «Guardar orden escrito».
        </p>
      )}

      <h2 className="mb-3 mt-6 text-lg font-semibold">Liquidación de la ruta</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Producto">
          <Tabla>
            <thead>
              <tr>
                <th>Clasificación</th>
                <th className="text-right">Llevado</th>
                <th className="text-right">Entregado</th>
                <th className="text-right">Devuelto</th>
                {pendientes > 0 && <th className="text-right">Por entregar</th>}
              </tr>
            </thead>
            <tbody>
              {porProducto.map((c) => (
                <tr key={c.productoId}>
                  <td>{nombres.get(c.productoId)?.nombre}</td>
                  <td className="text-right">{c.llevado}</td>
                  <td className="text-right">{c.entregado}</td>
                  <td className="text-right">{c.devuelto}</td>
                  {pendientes > 0 && <td className="text-right">{c.porEntregar}</td>}
                </tr>
              ))}
            </tbody>
          </Tabla>
          <p className="mt-2 text-xs text-stone-500">
            Devuelto es lo que el repartidor trae de vuelta: entregas parciales y pedidos no entregados.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Dinero">
          <Fila texto="Valor entregado" valor={cierre.valorEntregado} />
          <Fila texto="Pagado en las entregas (efectivo)" valor={cierre.pagadoEfectivo} />
          <Fila texto="Pagado en las entregas (transferencia)" valor={cierre.pagadoTransferencia} />
          <Fila texto="Abonos a deudas anteriores (efectivo)" valor={liquidacion.abonosEfectivo} />
          <Fila texto="Abonos a deudas anteriores (transferencia)" valor={liquidacion.abonosTransferencia} />
          <Fila texto="Quedó pendiente (fiado)" valor={cierre.pendiente} rojo />
          <Fila texto="Efectivo que debe entregar" valor={liquidacion.efectivoEsperado} fuerte />
          <p className="pt-1 text-xs text-stone-500">Las transferencias no se cuentan; se verifican en la caja.</p>
        </Tarjeta>

        {abierta ? (
          puede(sesion.operacion, "rutas") && (
            <Tarjeta titulo="Liquidar">
              <Formulario
                accion={liquidarRuta.bind(null, ruta.id)}
                confirmar="¿Liquidar la ruta? Después ya no se registran entregas ni cobros en ella."
              >
                {pendientes > 0 && (
                  <Alerta tipo="aviso">
                    Quedan {pendientes} paradas por entregar. Al liquidar quedan como no entregadas y se pueden reprogramar.
                  </Alerta>
                )}
                <Campo
                  etiqueta="Efectivo que entregó el repartidor"
                  ayuda={`El sistema espera ${formatoPesos(liquidacion.efectivoEsperado)}.`}
                >
                  <input name="entregado" inputMode="numeric" defaultValue={liquidacion.efectivoEsperado} required />
                </Campo>
                <Campo etiqueta="Observación" ayuda="Obligatoria si no cuadra. La diferencia se registra en la caja de hoy.">
                  <textarea name="observacion" rows={2} />
                </Campo>
                <Boton type="submit">Liquidar ruta</Boton>
              </Formulario>
            </Tarjeta>
          )
        ) : (
          <Tarjeta titulo="Liquidada">
            <Fila texto="Efectivo esperado" valor={ruta.efectivoEsperado ?? 0} />
            <Fila texto="Efectivo entregado" valor={ruta.efectivoEntregado ?? 0} />
            <div className={`flex justify-between py-1 font-semibold ${ruta.diferencia ? "text-red-700" : "text-green-700"}`}>
              <span>Diferencia</span>
              <span>{ruta.diferencia === 0 ? "Cuadrada" : formatoPesos(ruta.diferencia ?? 0)}</span>
            </div>
            <p className="mt-2 text-sm">
              Por {ruta.liquidadaPor?.nombre ?? "—"}
              {ruta.liquidadaEn && ` el ${formatoFechaHora(ruta.liquidadaEn)}`}
            </p>
            {ruta.observacion && <p className="text-sm text-stone-600">Observación: {ruta.observacion}</p>}
            {puede(sesion.operacion, "anular") && (
              <Formulario
                accion={reabrirRuta.bind(null, ruta.id)}
                className="mt-3"
                confirmar="¿Reabrir la liquidación? La diferencia registrada en caja se anula."
              >
                <Boton type="submit" variante="peligro">
                  Reabrir liquidación
                </Boton>
              </Formulario>
            )}
          </Tarjeta>
        )}

        <Tarjeta titulo={`Cobros en la ruta (${pagos.length})`}>
          {pagos.length === 0 ? (
            <p className="text-sm text-stone-500">Sin cobros.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {pagos.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span>
                    <a href={`/recibos/pago/${p.id}`} target="_blank" className="underline">
                      {formatoConsecutivo("AB", p.consecutivo)}
                    </a>{" "}
                    {p.cliente.nombre} · {p.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                  </span>
                  <span>{formatoPesos(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
