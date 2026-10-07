import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Alerta, Boton, BotonLink, Campo, Etiqueta, Subnav, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { obtenerCaja, totalesCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { efectivoEsperado, totalTransferencias } from "@/modules/caja";
import { actualizarBase, anularMovimientoCaja, cerrarCaja, reabrirCaja, verificarTransferencia } from "./acciones";

function Fila({ texto, valor, fuerte, signo }: { texto: string; valor: number; fuerte?: boolean; signo?: "+" | "−" }) {
  return (
    <div className={`flex justify-between py-1 ${fuerte ? "border-t border-stone-200 pt-2 font-semibold" : ""}`}>
      <span>{texto}</span>
      <span>
        {signo && valor > 0 ? `${signo} ` : ""}
        {formatoPesos(valor)}
      </span>
    </div>
  );
}

/** Estado de una transferencia frente al banco, con el botón para cambiarlo. */
function Verificacion({ entidad, id, verificadoEn }: { entidad: "Pago" | "MovimientoCaja"; id: number; verificadoEn: Date | null }) {
  return verificadoEn ? (
    <Formulario accion={verificarTransferencia.bind(null, entidad, id, false)} className="inline" confirmar="¿Quitar la verificación de esta transferencia?">
      <Etiqueta color="verde">Verificada</Etiqueta>{" "}
      <button type="submit" className="text-xs text-stone-500 underline">
        Quitar
      </button>
    </Formulario>
  ) : (
    <Formulario accion={verificarTransferencia.bind(null, entidad, id, true)} className="inline">
      <Etiqueta color="ambar">Sin verificar</Etiqueta>{" "}
      <button type="submit" className="text-xs underline">
        Ya llegó al banco
      </button>
    </Formulario>
  );
}

const SIN_VERIFICAR = { medio: "TRANSFERENCIA", anulado: false, verificadoEn: null } as const;

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ dia?: string; pagina?: string }> }) {
  const sesion = await requerir("caja");
  const hoy = hoyISO();
  const { dia: diaParam, pagina: paginaParam } = await searchParams;
  const pagina = leerPagina(paginaParam);
  const diaISO = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) && diaParam <= hoy ? diaParam : hoy;
  const dia = diaUTC(diaISO);

  // La caja de hoy se abre al entrar; los días pasados solo se consultan.
  const caja = await obtenerCaja(dia, db, diaISO === hoy);
  const [totales, pagos, movimientos, sinCerrar, pagosPendientes, movimientosPendientes] = await Promise.all([
    totalesCaja(dia, caja.base),
    db.pago.findMany({
      where: { dia },
      orderBy: { fecha: "asc" },
      include: { cliente: { select: { nombre: true } }, usuario: { select: { nombre: true } } },
    }),
    db.movimientoCaja.findMany({ where: { dia }, orderBy: { fecha: "asc" }, include: { usuario: { select: { nombre: true } } } }),
    db.caja.findMany({ where: { estado: "ABIERTA", dia: { lt: diaUTC(hoy) } }, orderBy: { dia: "asc" } }),
    db.pago.findMany({ where: { ...SIN_VERIFICAR, dia: { not: dia } }, select: { dia: true }, distinct: ["dia"] }),
    db.movimientoCaja.findMany({ where: { ...SIN_VERIFICAR, dia: { not: dia } }, select: { dia: true }, distinct: ["dia"] }),
  ]);
  // Otros días con transferencias que aún no se han confirmado en el banco.
  const diasSinVerificar = [...new Set([...pagosPendientes, ...movimientosPendientes].map((p) => p.dia.toISOString().slice(0, 10)))].sort();
  const pendiente = (x: { medio: string; anulado: boolean; verificadoEn: Date | null }) =>
    x.medio === "TRANSFERENCIA" && !x.anulado && !x.verificadoEn;
  const pagosPorVerificar = pagos.filter(pendiente);
  const movimientosPorVerificar = movimientos.filter(pendiente);
  const hayPendienteHoy = pagosPorVerificar.length + movimientosPorVerificar.length > 0;
  const pendienteHoy =
    pagosPorVerificar.reduce((t, p) => t + p.valor, 0) +
    movimientosPorVerificar.reduce((t, m) => t + (m.tipo === "EGRESO" ? -m.valor : m.valor), 0);
  const esperado = efectivoEsperado(totales);
  const abierta = caja.estado === "ABIERTA";
  const cerradaPor = caja.cerradaPorId ? await db.usuario.findUnique({ where: { id: caja.cerradaPorId } }) : null;

  return (
    <>
      <Titulo
        accion={
          <span className="flex flex-wrap gap-2">
            <BotonLink href={`/ingresos?dia=${diaISO}`} variante="secundario">
              Ingresos
            </BotonLink>
            <BotonLink href={`/egresos?dia=${diaISO}`} variante="secundario">
              Egresos
            </BotonLink>
            <BotonLink href="/caja/reporte" variante="secundario">
              Reporte quincenal
            </BotonLink>
          </span>
        }
      >
        Caja del {formatoDia(dia)}{" "}
        <Etiqueta color={abierta ? "ambar" : "verde"}>{abierta ? "Abierta" : "Cerrada"}</Etiqueta>
      </Titulo>
      <Subnav
        enlaces={[
          { id: "efectivo", texto: "Efectivo" },
          { id: "transferencias", texto: "Transferencias" },
          { id: "cierre", texto: abierta ? "Cerrar caja" : "Cierre" },
          { id: "cobros", texto: `Cobros (${pagos.length})` },
          { id: "movimientos", texto: `Otros movimientos (${movimientos.length})` },
          abierta && { id: "base", texto: "Base" },
        ]}
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label>
          Ver otro día
          <input type="date" name="dia" defaultValue={diaISO} max={hoy} className="mt-1" />
        </label>
        <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
          Ver
        </button>
      </form>

      {sinCerrar.length > 0 && (
        <div className="mb-4">
          <Alerta tipo="aviso">
            Días sin cerrar:{" "}
            {sinCerrar.map((c, i) => (
              <span key={c.dia.toISOString()}>
                {i > 0 && ", "}
                <Link href={`/caja?dia=${c.dia.toISOString().slice(0, 10)}`} className="underline">
                  {formatoDia(c.dia)}
                </Link>
              </span>
            ))}
          </Alerta>
        </div>
      )}

      {diasSinVerificar.length > 0 && (
        <div className="mb-4">
          <Alerta tipo="aviso">
            Transferencias sin verificar en el banco:{" "}
            {diasSinVerificar.map((d, i) => (
              <span key={d}>
                {i > 0 && ", "}
                <Link href={`/caja?dia=${d}`} className="underline">
                  {formatoDia(diaUTC(d))}
                </Link>
              </span>
            ))}
          </Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Tarjeta id="efectivo" titulo="Efectivo">
            <Fila texto="Base (efectivo al empezar)" valor={totales.base} />
            <Fila texto="Cobros en efectivo" valor={totales.cobrosEfectivo} signo="+" />
            <Fila texto="Otros ingresos en efectivo" valor={totales.ingresosEfectivo} signo="+" />
            <Fila texto="Gastos y retiros en efectivo" valor={totales.egresosEfectivo} signo="−" />
            <Fila texto="Efectivo esperado" valor={esperado} fuerte />
            {!abierta && (
              <>
                <Fila texto="Efectivo contado" valor={caja.contado ?? 0} />
                <div className={`flex justify-between py-1 font-semibold ${caja.diferencia ? "text-red-700" : "text-green-700"}`}>
                  <span>Diferencia</span>
                  <span>{caja.diferencia === 0 ? "Cuadrada" : formatoPesos(caja.diferencia ?? 0)}</span>
                </div>
              </>
            )}
          </Tarjeta>

          <Tarjeta id="transferencias" titulo="Transferencias (no entran al conteo)">
            <Fila texto="Cobros por transferencia" valor={totales.cobrosTransferencia} />
            <Fila texto="Otros ingresos por transferencia" valor={totales.ingresosTransferencia} signo="+" />
            <Fila texto="Gastos por transferencia" valor={totales.egresosTransferencia} signo="−" />
            <Fila texto="Neto en transferencias" valor={totalTransferencias(totales)} fuerte />
            {hayPendienteHoy && (
              <p className="pt-1 text-sm text-amber-700">
                Falta confirmar en el banco transferencias por un neto de {formatoPesos(pendienteHoy)}. Márcalas abajo cuando las veas en la cuenta.
              </p>
            )}
          </Tarjeta>

          {abierta ? (
            <Tarjeta id="cierre" titulo="Cerrar caja">
              <Formulario accion={cerrarCaja.bind(null, diaISO)} confirmar="¿Cerrar la caja de este día? Después solo el administrador puede reabrirla.">
                <p className="text-sm text-stone-600">
                  Cuenta el efectivo que hay en caja. El sistema espera <strong>{formatoPesos(esperado)}</strong>.
                </p>
                <Campo etiqueta="Efectivo contado" ayuda="Billetes y monedas, incluida la base. Las transferencias no se cuentan.">
                  <input name="contado" inputMode="numeric" required />
                </Campo>
                <Campo etiqueta="Observación" ayuda="Obligatoria si no cuadra.">
                  <textarea name="observacion" rows={2} />
                </Campo>
                <Boton type="submit">Cerrar caja</Boton>
              </Formulario>
            </Tarjeta>
          ) : (
            <Tarjeta id="cierre" titulo="Cierre">
              <p className="text-sm">
                Cerrada por {cerradaPor?.nombre ?? "—"}
                {caja.cerradaEn && ` el ${formatoFechaHora(caja.cerradaEn)}`}
              </p>
              {caja.observacion && <p className="mt-1 text-sm text-stone-600">Observación: {caja.observacion}</p>}
              {puede(sesion.operacion, "anular") && (
                <Formulario accion={reabrirCaja.bind(null, diaISO)} className="mt-3" confirmar="¿Reabrir esta caja? El cierre actual queda guardado en la auditoría.">
                  <Boton type="submit" variante="peligro">
                    Reabrir caja
                  </Boton>
                </Formulario>
              )}
            </Tarjeta>
          )}
        </div>

        <div className="space-y-4">
          <Tarjeta id="cobros" titulo={`Cobros del día (${pagos.length})`}>
            {pagos.length === 0 ? (
              <p className="text-sm text-stone-500">Sin cobros.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {paginar(pagos, pagina).map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <a href={`/recibos/pago/${p.id}`} target="_blank" className="underline">
                        {formatoConsecutivo("AB", p.consecutivo)}
                      </a>{" "}
                      {p.cliente.nombre} · {p.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                      <span className="text-stone-400"> · {p.usuario.nombre}</span>{" "}
                      {p.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                      {p.medio === "TRANSFERENCIA" && !p.anulado && <Verificacion entidad="Pago" id={p.id} verificadoEn={p.verificadoEn} />}
                    </span>
                    <span className={p.anulado ? "text-stone-400 line-through" : ""}>{formatoPesos(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Paginacion ruta="/caja" params={{ dia: diaISO }} pagina={pagina} total={pagos.length} ancla="cobros" />
          </Tarjeta>

          <Tarjeta id="movimientos" titulo="Otros ingresos, compras y gastos">
            {movimientos.length > 0 && (
              <ul className="mb-4 divide-y divide-stone-100 text-sm">
                {movimientos.map((m) => (
                  <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {m.tipo === "INGRESO" ? "Ingreso" : m.compraId ? "Compra" : m.pagoProveedorId ? "Pago a proveedor" : "Gasto"}: {m.concepto} · {m.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                      <span className="text-stone-400"> · {m.usuario.nombre}</span>{" "}
                      {m.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                      {m.medio === "TRANSFERENCIA" && !m.anulado && <Verificacion entidad="MovimientoCaja" id={m.id} verificadoEn={m.verificadoEn} />}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={m.anulado ? "text-stone-400 line-through" : m.tipo === "EGRESO" ? "text-red-700" : "text-green-700"}>
                        {m.tipo === "EGRESO" ? "−" : "+"}
                        {formatoPesos(m.valor)}
                      </span>
                      {abierta && !m.anulado && !m.rutaId && !m.compraId && !m.pagoProveedorId && (
                        <Formulario accion={anularMovimientoCaja.bind(null, m.id)} className="inline" confirmar="¿Anular este movimiento?">
                          <button type="submit" className="text-xs text-red-700 underline">
                            Anular
                          </button>
                        </Formulario>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {movimientos.length === 0 && <p className="mb-2 text-sm text-stone-500">Sin movimientos.</p>}
            <p className="text-sm text-stone-600">
              Se registran en{" "}
              <Link href={`/ingresos?dia=${diaISO}`} className="underline">
                Ingresos
              </Link>{" "}
              y{" "}
              <Link href={`/egresos?dia=${diaISO}`} className="underline">
                Egresos
              </Link>
              .
            </p>
          </Tarjeta>

          {abierta && (
            <Tarjeta id="base" titulo="Base">
              <Formulario accion={actualizarBase.bind(null, diaISO)} className="space-y-3">
                <p className="text-xs text-stone-500">Se toma del efectivo contado en el último cierre. Corrígela si no coincide.</p>
                <Campo etiqueta="Base">
                  <input name="base" inputMode="numeric" defaultValue={caja.base} required />
                </Campo>
                <Boton type="submit" variante="secundario">
                  Guardar base
                </Boton>
              </Formulario>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
