import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vistas, vistaElegida } from "@/components/ui";
import { ESTADO_PEDIDO, ESTADO_RUTA, esParcial } from "@/lib/estados";
import { formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { datosRuta } from "@/lib/rutas-datos";
import { requerir } from "@/lib/sesion";
import { devolverPrecierre, guardarOrden, liquidarRuta, ordenarRutaPorZona, quitarDeRuta, reabrirRuta } from "../acciones";

function Fila({ texto, valor, fuerte, rojo }: { texto: string; valor: number; fuerte?: boolean; rojo?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1 ${fuerte ? "border-t border-stone-200 pt-2 font-semibold" : ""} ${rojo && valor ? "text-red-700" : ""}`}
    >
      <span>{texto}</span>
      <span className="whitespace-nowrap tabular-nums">{formatoPesos(valor)}</span>
    </div>
  );
}

function FormularioLiquidar({
  rutaId,
  pendientes,
  esperado,
  entregado,
  observacion = "",
  aprobar = false,
}: {
  rutaId: number;
  pendientes: number;
  esperado: number;
  entregado: number;
  observacion?: string;
  aprobar?: boolean;
}) {
  return (
    <Formulario
      accion={liquidarRuta.bind(null, rutaId)}
      confirmar={`¿${aprobar ? "Aprobar el cierre y liquidar" : "Liquidar"} la ruta? Después ya no se registran entregas ni cobros en ella.`}
    >
      {pendientes > 0 && (
        <Alerta tipo="aviso">
          Quedan {pendientes} paradas por entregar. Al liquidar quedan como no entregadas y se pueden reprogramar.
        </Alerta>
      )}
      <Campo etiqueta="Efectivo que entregó el repartidor" ayuda={`El sistema espera ${formatoPesos(esperado)}. Corrígelo si al contar da otro valor.`}>
        <input name="entregado" inputMode="numeric" defaultValue={entregado} required />
      </Campo>
      <Campo etiqueta="Observación" ayuda="Obligatoria si no cuadra. La diferencia se registra en la caja de hoy.">
        <textarea name="observacion" rows={2} defaultValue={observacion} />
      </Campo>
      <Boton type="submit">{aprobar ? "Aprobar cierre" : "Liquidar ruta"}</Boton>
    </Formulario>
  );
}

export default async function RutaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const sesion = await requerir("rutas");
  const id = Number((await params).id);
  const pedida = (await searchParams).ver;
  const datos = Number.isInteger(id) ? await datosRuta(id) : null;
  if (!datos) notFound();
  const { ruta, filas, cierre, liquidacion, pagos } = datos;
  const abierta = ruta.estado === "ABIERTA";
  const aprueba = puede(sesion.operacion, "rutas.aprobar");
  const pendientes = filas.filter((f) => f.pedido.estado === "PENDIENTE").length;
  const fecha = ruta.fecha.toISOString().slice(0, 10);
  const nombres = new Map(filas.flatMap((f) => f.pedido.detalles.map((d) => [d.productoId, d.producto] as const)));
  const porProducto = [...cierre.porProducto].sort(
    (a, b) => (nombres.get(a.productoId)?.orden ?? 0) - (nombres.get(b.productoId)?.orden ?? 0),
  );

  // Una parte a la vez; la liquidación primero porque es lo que se revisa y aprueba.
  const vistas = [
    { clave: "liquidacion", texto: ruta.estado === "PRECERRADA" ? "Liquidación · por aprobar" : "Liquidación" },
    { clave: "paradas", texto: `Paradas (${filas.length})` },
    { clave: "cobros", texto: `Cobros (${pagos.length})` },
  ];
  const ver = vistaElegida(pedida, vistas);

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
        <Etiqueta color={ESTADO_RUTA[ruta.estado].color}>{ESTADO_RUTA[ruta.estado].texto}</Etiqueta>
      </Titulo>
      <p className="mb-4 text-stone-600">
        {filas.length} paradas · {cierre.entregados} entregadas · {pendientes} por entregar · {cierre.noEntregados} no entregadas
      </p>
      <Vistas ruta={`/rutas/${ruta.id}`} actual={ver ?? ""} vistas={vistas} />

      {ver === "liquidacion" && (
        // Dos columnas que crecen por separado (sin huecos): Producto y la acción a la izquierda, Dinero a la derecha.
        // En el celular las columnas se deshacen (contents) y el orden es Producto, Dinero y la acción, para ver el
        // efectivo esperado antes de liquidar.
        <div className="mb-6 grid items-start gap-4 lg:grid-cols-2">
          <div className="contents lg:block lg:space-y-4">
            <Tarjeta titulo="Producto" className="order-1">
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
                      <td className="text-right tabular-nums">{c.llevado}</td>
                      <td className="text-right tabular-nums">{c.entregado}</td>
                      <td className="text-right tabular-nums">{c.devuelto}</td>
                      {pendientes > 0 && <td className="text-right tabular-nums">{c.porEntregar}</td>}
                    </tr>
                  ))}
                </tbody>
              </Tabla>
              <p className="mt-2 text-sm text-stone-500">
                Devuelto es lo que el repartidor trae de vuelta: entregas parciales y pedidos no entregados.
              </p>
            </Tarjeta>

            {ruta.estado === "ABIERTA" &&
              (aprueba ? (
                <Tarjeta titulo="Liquidar sin precierre" className="order-3">
                  <p className="mb-3 text-stone-600">
                    El repartidor todavía no ha enviado su precierre. Si ya entregó el efectivo, puedes liquidar la ruta directamente.
                  </p>
                  <FormularioLiquidar rutaId={ruta.id} pendientes={pendientes} esperado={liquidacion.efectivoEsperado} entregado={liquidacion.efectivoEsperado} />
                </Tarjeta>
              ) : (
                <Tarjeta titulo="Cierre" className="order-3">
                  <p className="text-stone-600">
                    Cuando termine, el repartidor envía su precierre desde Mi ruta y el administrador lo aprueba.
                  </p>
                </Tarjeta>
              ))}

            {ruta.estado === "PRECERRADA" && (
              <Tarjeta titulo="Precierre del repartidor" className="order-3">
                <Fila texto="Efectivo que debía entregar" valor={ruta.efectivoEsperado ?? 0} />
                <Fila texto="Efectivo que dice entregar" valor={ruta.efectivoEntregado ?? 0} />
                <div className={`flex justify-between py-1 font-semibold ${ruta.diferencia ? "text-red-700" : "text-green-700"}`}>
                  <span>Diferencia</span>
                  <span className="tabular-nums">{ruta.diferencia === 0 ? "Cuadrada" : formatoPesos(ruta.diferencia ?? 0)}</span>
                </div>
                {ruta.precerradaEn && <p className="mt-2">Enviado el {formatoFechaHora(ruta.precerradaEn)}</p>}
                {ruta.observacion && <p className="text-stone-600">Observación: {ruta.observacion}</p>}
                {liquidacion.efectivoEsperado !== ruta.efectivoEsperado && (
                  <div className="mt-3">
                    <Alerta tipo="aviso">
                      Desde el precierre cambiaron los cobros: ahora el sistema espera {formatoPesos(liquidacion.efectivoEsperado)}.
                    </Alerta>
                  </div>
                )}
                {aprueba && (
                  <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
                    <FormularioLiquidar
                      rutaId={ruta.id}
                      pendientes={pendientes}
                      esperado={liquidacion.efectivoEsperado}
                      entregado={ruta.efectivoEntregado ?? 0}
                      observacion={ruta.observacion ?? ""}
                      aprobar
                    />
                    <Formulario
                      accion={devolverPrecierre.bind(null, ruta.id)}
                      confirmar="¿Devolver el precierre? La ruta vuelve a quedar abierta para que el repartidor corrija."
                    >
                      <Boton type="submit" variante="secundario">
                        Devolver al repartidor
                      </Boton>
                    </Formulario>
                  </div>
                )}
              </Tarjeta>
            )}

            {ruta.estado === "LIQUIDADA" && (
              <Tarjeta titulo="Liquidada" className="order-3">
                <Fila texto="Efectivo esperado" valor={ruta.efectivoEsperado ?? 0} />
                <Fila texto="Efectivo entregado" valor={ruta.efectivoEntregado ?? 0} />
                <div className={`flex justify-between py-1 font-semibold ${ruta.diferencia ? "text-red-700" : "text-green-700"}`}>
                  <span>Diferencia</span>
                  <span className="tabular-nums">{ruta.diferencia === 0 ? "Cuadrada" : formatoPesos(ruta.diferencia ?? 0)}</span>
                </div>
                {ruta.precerradaEn && <p className="mt-2">Precierre del repartidor el {formatoFechaHora(ruta.precerradaEn)}</p>}
                <p>
                  Aprobada por {ruta.liquidadaPor?.nombre ?? "—"}
                  {ruta.liquidadaEn && ` el ${formatoFechaHora(ruta.liquidadaEn)}`}
                </p>
                {ruta.observacion && <p className="text-stone-600">Observación: {ruta.observacion}</p>}
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
          </div>
          <div className="contents lg:block">
            <Tarjeta titulo="Dinero" className="order-2">
              <Fila texto="Valor entregado" valor={cierre.valorEntregado} />
              <Fila texto="Pagado en las entregas (efectivo)" valor={cierre.pagadoEfectivo} />
              <Fila texto="Pagado en las entregas (transferencia)" valor={cierre.pagadoTransferencia} />
              <Fila texto="Abonos a deudas anteriores (efectivo)" valor={liquidacion.abonosEfectivo} />
              <Fila texto="Abonos a deudas anteriores (transferencia)" valor={liquidacion.abonosTransferencia} />
              <Fila texto="Quedó pendiente (fiado)" valor={cierre.pendiente} rojo />
              <Fila texto="Efectivo que debe entregar" valor={liquidacion.efectivoEsperado} fuerte />
              <p className="pt-1 text-sm text-stone-500">Las transferencias no se cuentan; se verifican en la caja.</p>
            </Tarjeta>
          </div>
        </div>
      )}
      {ver === "paradas" && (
        <>
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
            <Alerta tipo="aviso">La ruta no tiene paradas. El repartidor toma sus pedidos desde Mi ruta.</Alerta>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  {/* En el celular quedan Orden, Cliente (con lo fiado debajo) y Estado; el resto está en la liquidación. */}
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th className="hidden sm:table-cell">Productos</th>
                  <th className="hidden text-right sm:table-cell">Valor</th>
                  <th className="hidden text-right sm:table-cell">Pagado</th>
                  <th className="hidden text-right sm:table-cell">Pendiente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ pedido: p, reparto, valores }) => (
                  <tr key={p.id}>
                    <td className="w-16">
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
                      <span className="block text-stone-600">{[p.cliente.zona, p.cliente.direccion].filter(Boolean).join(" · ")}</span>
                      {reparto.entregado && valores.pendiente > 0 && (
                        <span className="block font-medium whitespace-nowrap text-red-700 sm:hidden">Fiado {formatoPesos(valores.pendiente)}</span>
                      )}
                    </td>
                    <td className="hidden text-stone-600 sm:table-cell">
                      {p.detalles.map((d) => `${d.cantidadEntregada ?? d.cantidad} ${d.producto.nombre}`).join(", ")}
                    </td>
                    <td className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{formatoPesos(valores.valor)}</td>
                    <td className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{reparto.entregado ? formatoPesos(valores.pagado) : "–"}</td>
                    <td className={`hidden whitespace-nowrap text-right tabular-nums sm:table-cell ${valores.pendiente > 0 ? "text-red-700" : ""}`}>
                      {reparto.entregado ? formatoPesos(valores.pendiente) : "–"}
                    </td>
                    <td>
                      <Etiqueta color={ESTADO_PEDIDO[p.estado].color}>
                        {ESTADO_PEDIDO[p.estado].texto}
                        {p.estado === "ENTREGADO" && esParcial(p.detalles) && " parcial"}
                      </Etiqueta>
                      {p.motivoNoEntrega && <span className="mt-1 block text-stone-600">{p.motivoNoEntrega}</span>}
                      {abierta && p.estado === "PENDIENTE" && (
                        <Formulario accion={quitarDeRuta.bind(null, p.id)}>
                          <button type="submit" className="min-h-11 text-red-700 underline">
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
            <p className="mt-2 text-sm text-stone-500">
              Para cambiar el orden escribe el número de parada (por ejemplo, 1 para que vaya de primera) y pulsa «Guardar orden escrito».
            </p>
          )}
        </>
      )}
      {ver === "cobros" && (
        <Tarjeta>
          {pagos.length === 0 ? (
            <p className="text-stone-500">Sin cobros.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {pagos.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span>
                    <a href={`/recibos/pago/${p.id}`} target="_blank" className="underline">
                      {formatoConsecutivo("AB", p.consecutivo)}
                    </a>{" "}
                    {p.cliente.nombre} · {p.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">{formatoPesos(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}
    </>
  );
}
