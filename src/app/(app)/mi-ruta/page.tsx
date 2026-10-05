import { Buscador } from "@/components/buscador";
import { Formulario } from "@/components/formulario";
import { leerFecha, SelectorDia } from "@/components/selector-dia";
import { Alerta, Boton, Campo, Etiqueta, Titulo, Vacio } from "@/components/ui";
import { deudasDeClientes, type DeudaCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { ESTADO_PEDIDO, esParcial } from "@/lib/estados";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFecha, formatoPesos, hoyISO, nombreProducto } from "@/lib/formato";
import { datosRuta } from "@/lib/rutas-datos";
import { requerir } from "@/lib/sesion";
import { normalizar } from "@/lib/texto";
import { enlaceLlamar, enlaceMaps, enlaceWhatsApp } from "@/modules/contacto";
import { totalPedido } from "@/modules/precios";
import { entregarPedido, marcarNoEntregado } from "../pedidos/acciones";
import { abonoEnRuta } from "../rutas/acciones";

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
  siguiente,
}: {
  fila: FilaRuta;
  rutaId: number;
  deuda: DeudaCliente | undefined;
  hoy: Date;
  siguiente: boolean;
}) {
  const p = fila.pedido;
  const c = p.cliente;
  const total = totalPedido(p.detalles);
  const llamar = enlaceLlamar(c.telefono);
  const whatsapp = enlaceWhatsApp(c.telefono);
  const maps = enlaceMaps(c);
  return (
    <li
      data-buscar={normalizar([c.nombre, c.zona, c.direccion, c.telefono].filter(Boolean).join(" "))}
      className={`space-y-3 rounded border bg-white p-4 ${siguiente ? "border-amber-500 border-2" : "border-stone-200"}`}
    >
      <div>
        {siguiente && <p className="text-xs font-semibold uppercase text-amber-700">Siguiente parada</p>}
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
            WhatsApp
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

export default async function MiRutaPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const sesion = await requerir("ruta.propia");
  const fecha = leerFecha((await searchParams).fecha);
  const hoy = diaUTC(hoyISO());
  const ruta = await db.ruta.findUnique({ where: { fecha_repartidorId: { fecha: diaUTC(fecha), repartidorId: sesion.usuario.id } } });
  const datos = ruta ? await datosRuta(ruta.id) : null;

  return (
    <>
      <Titulo>Mi ruta del {formatoDia(diaUTC(fecha))}</Titulo>
      <SelectorDia ruta="/mi-ruta" fecha={fecha} />
      {!datos ? <Vacio>No tienes ruta asignada para ese día.</Vacio> : <RutaRepartidor datos={datos} hoy={hoy} />}
    </>
  );
}

async function RutaRepartidor({ datos, hoy }: { datos: Datos; hoy: Date }) {
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
      {!abierta && (
        <div className="mb-4">
          <Alerta tipo="ok">Esta ruta ya se liquidó.</Alerta>
        </div>
      )}

      {abierta && pendientes.length > 0 && (
        <>
          <div className="mb-3">
            <Buscador objetivo="paradas" placeholder="Buscar cliente, barrio o dirección" />
          </div>
          <ul id="paradas" className="space-y-3">
            {pendientes.map((f, i) => (
              <Parada key={f.pedido.id} fila={f} rutaId={ruta.id} deuda={deudas.get(f.pedido.clienteId)} hoy={hoy} siguiente={i === 0} />
            ))}
          </ul>
        </>
      )}
      {abierta && pendientes.length === 0 && filas.length > 0 && (
        <Alerta tipo="ok">Terminaste las entregas. Entrega el efectivo para liquidar la ruta.</Alerta>
      )}

      {hechas.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Hechas ({hechas.length})</h2>
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
