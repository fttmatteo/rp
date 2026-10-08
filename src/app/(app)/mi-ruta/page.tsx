import type { ReactNode } from "react";
import { Buscador } from "@/components/buscador";
import { Formulario } from "@/components/formulario";
import { leerFecha, SelectorDia } from "@/components/selector-dia";
import { Alerta, Boton, Campo, Etiqueta, Titulo, Vacio, Vistas, vistaElegida } from "@/components/ui";
import { deudasDeClientes, type DeudaCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { ESTADO_PEDIDO, esParcial } from "@/lib/estados";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFecha, formatoPesos, hoyISO, nombreProducto } from "@/lib/formato";
import { datosRuta } from "@/lib/rutas-datos";
import { requerir } from "@/lib/sesion";
import { normalizar } from "@/lib/texto";
import { enlaceLlamar, enlaceMaps, enlaceWhatsApp } from "@/modules/contacto";
import { mensajeEnCamino } from "@/modules/mensajes";
import { totalPedido } from "@/modules/precios";
import { entregarPedido, marcarNoEntregado } from "../pedidos/acciones";
import { abonoEnRuta, precerrarRuta, soltarPedido, tomarPedidos } from "../rutas/acciones";

type Datos = NonNullable<Awaited<ReturnType<typeof datosRuta>>>;
type FilaRuta = Datos["filas"][number];

const dias = (desde: Date, hoy: Date) => Math.max(0, Math.floor((hoy.getTime() - desde.getTime()) / 86_400_000));

function SelectMedio() {
  return (
    <select name="medio" defaultValue="EFECTIVO">
      <option value="EFECTIVO">Efectivo</option>
      <option value="TRANSFERENCIA">Transferencia</option>
    </select>
  );
}

function Deuda({ deuda, hoy }: { deuda: DeudaCliente | undefined; hoy: Date }) {
  if (!deuda || deuda.saldo === 0) return <p className="text-sm text-green-700">No debe nada.</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer">
        Debe <strong className="text-red-700">{formatoPesos(deuda.saldo)}</strong>
        {deuda.vencido > 0 && <> · vencido {formatoPesos(deuda.vencido)}</>}
        {deuda.masAntigua && <> · la más antigua de hace {dias(deuda.masAntigua, hoy)} días</>}
      </summary>
      <ul className="mt-1 space-y-0.5 text-stone-600">
        {deuda.deudas.map((d) => (
          <li key={d.id}>
            {formatoConsecutivo("RP", d.consecutivo)} · {formatoFecha(d.fecha)} · {dias(d.fecha, hoy)} días · {formatoPesos(d.saldo)}
            {d.vence < hoy && " · vencida"}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Parada({
  fila,
  rutaId,
  deuda,
  hoy,
}: {
  fila: FilaRuta;
  rutaId: number;
  deuda: DeudaCliente | undefined;
  hoy: Date;
}) {
  const p = fila.pedido;
  const c = p.cliente;
  const total = totalPedido(p.detalles);
  const llamar = enlaceLlamar(c.telefono);
  const whatsapp = enlaceWhatsApp(c.telefono, mensajeEnCamino(c.nombre));
  const maps = enlaceMaps(c);
  return (
    <li
      data-buscar={normalizar([c.nombre, c.zona, c.direccion, c.telefono].filter(Boolean).join(" "))}
      className="space-y-3 rounded border border-stone-200 bg-white p-4"
    >
      <div>
        <p className="text-lg font-semibold">
          {p.ordenEnRuta}. {c.nombre}
        </p>
        <p className="text-sm text-stone-600">{[c.direccion, c.zona].filter(Boolean).join(" · ") || "Sin dirección"}</p>
        {p.nota && <p className="text-sm text-stone-600">Nota: {p.nota}</p>}
      </div>
      <p>
        {p.detalles.map((d) => `${d.cantidad} ${nombreProducto(d.producto)}`).join(", ")} · <strong>{formatoPesos(total)}</strong>
      </p>
      <Deuda deuda={deuda} hoy={hoy} />
      <div className="flex flex-wrap gap-2 text-sm">
        {llamar && (
          <a href={llamar} className="rounded border border-stone-300 px-3 py-2">
            Llamar
          </a>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded border border-stone-300 px-3 py-2">
            Avisar que va en camino
          </a>
        )}
        {maps && (
          <a href={maps} target="_blank" rel="noreferrer" className="rounded border border-stone-300 px-3 py-2">
            Abrir en Maps
          </a>
        )}
      </div>

      <Formulario accion={entregarPedido.bind(null, p.id)} className="space-y-2">
        <input type="hidden" name="pagado" value={total} />
        <input type="hidden" name="medio" value="EFECTIVO" />
        <Boton type="submit" className="w-full">
          Entregado y pagó {formatoPesos(total)} en efectivo
        </Boton>
      </Formulario>

      <details>
        <summary className="cursor-pointer text-sm underline">Fiado, transferencia, pago distinto o entrega parcial</summary>
        <Formulario accion={entregarPedido.bind(null, p.id)} className="mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="¿Cuánto pagó?" ayuda="0 si se fía todo. Si paga más, lo que sobra abona a sus deudas.">
              <input name="pagado" inputMode="numeric" defaultValue={total} required />
            </Campo>
            <Campo etiqueta="Medio">
              <SelectMedio />
            </Campo>
          </div>
          <Campo etiqueta="Referencia">
            <input name="referencia" placeholder="Si es transferencia" />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            {p.detalles.map((d) => (
              <Campo key={d.id} etiqueta={`${nombreProducto(d.producto)} entregadas`}>
                <input name={`entregada_${d.id}`} inputMode="numeric" defaultValue={d.cantidad} />
              </Campo>
            ))}
          </div>
          <Boton type="submit" variante="secundario">
            Registrar entrega
          </Boton>
        </Formulario>
      </details>

      <details>
        <summary className="cursor-pointer text-sm underline">No se entregó</summary>
        <Formulario accion={marcarNoEntregado.bind(null, p.id)} className="mt-2 space-y-3">
          <Campo etiqueta="Motivo">
            <input name="motivo" required placeholder="Ej.: local cerrado" />
          </Campo>
          <Boton type="submit" variante="peligro">
            Marcar no entregado
          </Boton>
        </Formulario>
      </details>

      {deuda && deuda.saldo > 0 && <Abono rutaId={rutaId} clienteId={c.id} saldo={deuda.saldo} />}

      <Formulario accion={soltarPedido.bind(null, p.id)} confirmar={`¿Soltar el pedido de ${c.nombre}? Queda libre para otro repartidor.`}>
        <button type="submit" className="text-sm text-stone-600 underline">
          Soltar este pedido (no lo voy a llevar)
        </button>
      </Formulario>
    </li>
  );
}

function Abono({ rutaId, clienteId, saldo }: { rutaId: number; clienteId: number; saldo: number }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm underline">Solo abono a la deuda</summary>
      <Formulario accion={abonoEnRuta.bind(null, rutaId, clienteId)} className="mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Valor" ayuda={`Debe ${formatoPesos(saldo)}. Se aplica a la deuda más antigua.`}>
            <input name="valor" inputMode="numeric" required />
          </Campo>
          <Campo etiqueta="Medio">
            <SelectMedio />
          </Campo>
        </div>
        <Campo etiqueta="Referencia">
          <input name="referencia" placeholder="Si es transferencia" />
        </Campo>
        <Boton type="submit" variante="secundario">
          Registrar abono
        </Boton>
      </Formulario>
    </details>
  );
}

type Disponible = Awaited<ReturnType<typeof pedidosSinTomar>>[number];

/** Pedidos pendientes del día que ningún repartidor ha tomado. */
function pedidosSinTomar(dia: Date) {
  return db.pedido.findMany({
    where: { fechaEntrega: dia, estado: "PENDIENTE", rutaId: null },
    orderBy: [{ cliente: { zona: "asc" } }, { cliente: { nombre: "asc" } }],
    include: { cliente: true, detalles: { include: { producto: true }, orderBy: { id: "asc" } } },
  });
}

function TomarPedidos({ pedidos, titulo }: { pedidos: Disponible[]; titulo: boolean }) {
  return (
    <section>
      {/* Con ruta, el título ya está en la pestaña. */}
      {titulo && <h2 className="mb-2 font-semibold">Pedidos sin tomar ({pedidos.length})</h2>}
      {/* El formulario queda montado aunque ya no haya pedidos, para que se vea la confirmación. */}
      <Formulario accion={tomarPedidos} className="space-y-3">
        {pedidos.length === 0 ? (
          <p className="text-sm text-stone-500">No quedan pedidos de hoy sin tomar.</p>
        ) : (
          <>
            <div className="mb-3">
              <Buscador objetivo="sin-tomar" placeholder="Buscar cliente, barrio o dirección" />
            </div>
            <ul id="sin-tomar" className="divide-y divide-stone-100 rounded border border-stone-200 bg-white">
              {pedidos.map((p) => (
                <li
                  key={p.id}
                  data-buscar={normalizar([p.cliente.nombre, p.cliente.zona, p.cliente.direccion].filter(Boolean).join(" "))}
                >
                  <label className="flex items-start gap-3 px-3 py-3">
                    <input type="checkbox" name="pedido" value={p.id} className="mt-1 size-5" />
                    <span className="text-sm">
                      <strong>{p.cliente.nombre}</strong>
                      <span className="block text-stone-600">
                        {[p.cliente.direccion, p.cliente.zona].filter(Boolean).join(" · ") || "Sin dirección"}
                      </span>
                      <span className="block">
                        {p.detalles.map((d) => `${d.cantidad} ${nombreProducto(d.producto)}`).join(", ")} ·{" "}
                        {formatoPesos(totalPedido(p.detalles))}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Boton type="submit" className="w-full">
              Tomar los pedidos marcados
            </Boton>
          </>
        )}
      </Formulario>
    </section>
  );
}

export default async function MiRutaPage({ searchParams }: { searchParams: Promise<{ fecha?: string; ver?: string }> }) {
  const sesion = await requerir("ruta.propia");
  const sp = await searchParams;
  const fecha = leerFecha(sp.fecha);
  const hoy = diaUTC(hoyISO());
  const dia = diaUTC(fecha);
  const ruta = await db.ruta.findUnique({ where: { fecha_repartidorId: { fecha: dia, repartidorId: sesion.usuario.id } } });
  const datos = ruta ? await datosRuta(ruta.id) : null;
  // Los pedidos se toman el mismo día de la entrega, mientras la ruta siga abierta.
  const puedeTomar = dia.getTime() === hoy.getTime() && (!ruta || ruta.estado === "ABIERTA");
  const disponibles = puedeTomar ? await pedidosSinTomar(dia) : [];
  const abierta = ruta?.estado === "ABIERTA";
  const paradas = datos?.filas.length ?? 0;
  const pendientes = datos?.filas.filter((f) => f.pedido.estado === "PENDIENTE").length ?? 0;
  // Una parte a la vez: lo que falta entregar (o el precierre, cuando ya no falta nada), lo hecho y lo que se puede tomar.
  const vistas = [
    abierta && pendientes > 0 && { clave: "entregar", texto: `Por entregar (${pendientes})` },
    abierta && pendientes === 0 && paradas > 0 && { clave: "entregar", texto: "Precierre" },
    paradas - pendientes > 0 && { clave: "hechas", texto: `Hechas (${paradas - pendientes})` },
    puedeTomar && { clave: "sin-tomar", texto: `Sin tomar (${disponibles.length})` },
  ];
  const ver = vistaElegida(sp.ver, vistas);
  // Sin ruta solo queda «Sin tomar», así que no hay pestañas; con ruta van debajo del resumen.
  const pestanas = <Vistas ruta="/mi-ruta" actual={ver ?? ""} vistas={vistas} params={{ fecha }} />;

  return (
    <>
      <Titulo>Mi ruta del {formatoDia(dia)}</Titulo>
      <SelectorDia ruta="/mi-ruta" fecha={fecha} />
      {datos ? (
        <RutaRepartidor datos={datos} hoy={hoy} ver={ver} pestanas={pestanas} />
      ) : (
        !puedeTomar && <Vacio>No tuviste ruta ese día.</Vacio>
      )}
      {ver === "sin-tomar" && <TomarPedidos pedidos={disponibles} titulo={!datos} />}
    </>
  );
}

function Precierre({ rutaId, esperado }: { rutaId: number; esperado: number }) {
  return (
    <Formulario
      accion={precerrarRuta.bind(null, rutaId)}
      confirmar="¿Enviar el precierre? Después ya no puedes registrar entregas ni cobros en esta ruta."
      className="space-y-3 rounded border border-stone-200 bg-white p-4"
    >
      <p className="font-semibold">Precierre de la ruta</p>
      <p className="text-sm text-stone-600">
        Terminaste las entregas. Cuenta el efectivo que vas a entregar; el administrador lo revisa y aprueba el cierre.
      </p>
      <Campo etiqueta="Efectivo que entregas" ayuda={`Según tus cobros deberías entregar ${formatoPesos(esperado)}.`}>
        <input name="entregado" inputMode="numeric" defaultValue={esperado} required />
      </Campo>
      <Campo etiqueta="Observación" ayuda="Obligatoria si no cuadra.">
        <textarea name="observacion" rows={2} />
      </Campo>
      <Boton type="submit" className="w-full">
        Enviar precierre
      </Boton>
    </Formulario>
  );
}

async function RutaRepartidor({ datos, hoy, ver, pestanas }: { datos: Datos; hoy: Date; ver?: string; pestanas: ReactNode }) {
  const { ruta, filas, cierre, liquidacion } = datos;
  const abierta = ruta.estado === "ABIERTA";
  const pendientes = filas.filter((f) => f.pedido.estado === "PENDIENTE");
  const hechas = filas.filter((f) => f.pedido.estado !== "PENDIENTE");
  const deudas = await deudasDeClientes([...new Set(filas.map((f) => f.pedido.clienteId))], hoy);

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded border border-stone-200 bg-white p-2">
          <p className="text-2xl font-semibold">{pendientes.length}</p>
          por entregar
        </div>
        <div className="rounded border border-stone-200 bg-white p-2">
          <p className="text-2xl font-semibold">{cierre.entregados}</p>
          entregadas
        </div>
        <div className="rounded border border-stone-200 bg-white p-2">
          <p className="text-lg font-semibold">{formatoPesos(liquidacion.cobradoEfectivo)}</p>
          efectivo cobrado
        </div>
      </div>
      {ruta.estado === "PRECERRADA" && (
        <div className="mb-4">
          <Alerta tipo="aviso">
            Enviaste el precierre: entregas {formatoPesos(ruta.efectivoEntregado ?? 0)}. Falta la aprobación del administrador.
          </Alerta>
        </div>
      )}
      {ruta.estado === "LIQUIDADA" && (
        <div className="mb-4">
          <Alerta tipo="ok">El administrador aprobó el cierre. Esta ruta ya se liquidó.</Alerta>
        </div>
      )}
      {pestanas}

      {ver === "entregar" && pendientes.length > 0 && (
        <div>
          <div className="mb-3">
            <Buscador objetivo="paradas" placeholder="Buscar cliente, barrio o dirección" />
          </div>
          <ul id="paradas" className="space-y-3">
            {pendientes.map((f) => (
              <Parada key={f.pedido.id} fila={f} rutaId={ruta.id} deuda={deudas.get(f.pedido.clienteId)} hoy={hoy} />
            ))}
          </ul>
        </div>
      )}
      {ver === "entregar" && pendientes.length === 0 && <Precierre rutaId={ruta.id} esperado={liquidacion.efectivoEsperado} />}

      {ver === "hechas" && (
        <>
          <ul className="divide-y divide-stone-100 rounded border border-stone-200 bg-white text-sm">
            {hechas.map(({ pedido: p, valores }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {p.ordenEnRuta}. {p.cliente.nombre}{" "}
                  <Etiqueta color={ESTADO_PEDIDO[p.estado].color}>
                    {ESTADO_PEDIDO[p.estado].texto}
                    {p.estado === "ENTREGADO" && esParcial(p.detalles) && " parcial"}
                  </Etiqueta>
                </span>
                {p.estado === "ENTREGADO" && p.venta && (
                  <span>
                    Pagó {formatoPesos(valores.pagado)}
                    {valores.pendiente > 0 && <span className="text-red-700"> · fiado {formatoPesos(valores.pendiente)}</span>} ·{" "}
                    <a href={`/recibos/venta/${p.venta.id}`} target="_blank" className="underline">
                      Recibo
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
