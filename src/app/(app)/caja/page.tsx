import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { obtenerCaja, totalesCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { efectivoEsperado, totalTransferencias } from "@/modules/caja";
import { actualizarBase, anularMovimientoCaja, cerrarCaja, reabrirCaja, registrarMovimientoCaja } from "./acciones";

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

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const sesion = await requerir("caja");
  const hoy = hoyISO();
  const { dia: diaParam } = await searchParams;
  const diaISO = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) && diaParam <= hoy ? diaParam : hoy;
  const dia = diaUTC(diaISO);

  // La caja de hoy se abre al entrar; los días pasados solo se consultan.
  const caja = await obtenerCaja(dia, db, diaISO === hoy);
  const [totales, pagos, movimientos, sinCerrar] = await Promise.all([
    totalesCaja(dia, caja.base),
    db.pago.findMany({ where: { dia }, orderBy: { fecha: "asc" }, include: { cliente: true, usuario: true } }),
    db.movimientoCaja.findMany({ where: { dia }, orderBy: { fecha: "asc" }, include: { usuario: true } }),
    db.caja.findMany({ where: { estado: "ABIERTA", dia: { lt: diaUTC(hoy) } }, orderBy: { dia: "asc" } }),
  ]);
  const esperado = efectivoEsperado(totales);
  const abierta = caja.estado === "ABIERTA";
  const cerradaPor = caja.cerradaPorId ? await db.usuario.findUnique({ where: { id: caja.cerradaPorId } }) : null;

  return (
    <>
      <Titulo accion={<BotonLink href="/caja/reporte" variante="secundario">Reporte quincenal</BotonLink>}>
        Caja del {formatoDia(dia)}{" "}
        <Etiqueta color={abierta ? "ambar" : "verde"}>{abierta ? "Abierta" : "Cerrada"}</Etiqueta>
      </Titulo>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Tarjeta titulo="Efectivo">
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

          <Tarjeta titulo="Transferencias (no entran al conteo)">
            <Fila texto="Cobros por transferencia" valor={totales.cobrosTransferencia} />
            <Fila texto="Otros ingresos por transferencia" valor={totales.ingresosTransferencia} signo="+" />
            <Fila texto="Gastos por transferencia" valor={totales.egresosTransferencia} signo="−" />
            <Fila texto="Neto en transferencias" valor={totalTransferencias(totales)} fuerte />
          </Tarjeta>

          {abierta ? (
            <Tarjeta titulo="Cerrar caja">
              <Formulario accion={cerrarCaja.bind(null, diaISO)} confirmar="¿Cerrar la caja de este día? Después solo el administrador puede reabrirla.">
                <p className="text-sm text-stone-600">
                  Cuenta el efectivo que hay en caja. El sistema espera <strong>{formatoPesos(esperado)}</strong>.
                </p>
                <Campo etiqueta="Efectivo contado">
                  <input name="contado" inputMode="numeric" required />
                </Campo>
                <Campo etiqueta="Observación" ayuda="Obligatoria si no cuadra.">
                  <textarea name="observacion" rows={2} />
                </Campo>
                <Boton type="submit">Cerrar caja</Boton>
              </Formulario>
            </Tarjeta>
          ) : (
            <Tarjeta titulo="Cierre">
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
          <Tarjeta titulo={`Cobros del día (${pagos.length})`}>
            {pagos.length === 0 ? (
              <p className="text-sm text-stone-500">Sin cobros.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {pagos.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <a href={`/recibos/pago/${p.id}`} target="_blank" className="underline">
                        {formatoConsecutivo("AB", p.consecutivo)}
                      </a>{" "}
                      {p.cliente.nombre} · {p.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                      <span className="text-stone-400"> · {p.usuario.nombre}</span>{" "}
                      {p.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                    </span>
                    <span className={p.anulado ? "text-stone-400 line-through" : ""}>{formatoPesos(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Otros ingresos, gastos y retiros">
            {movimientos.length > 0 && (
              <ul className="mb-4 divide-y divide-stone-100 text-sm">
                {movimientos.map((m) => (
                  <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {m.tipo === "INGRESO" ? "Ingreso" : "Gasto"}: {m.concepto} · {m.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                      <span className="text-stone-400"> · {m.usuario.nombre}</span>{" "}
                      {m.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={m.anulado ? "text-stone-400 line-through" : m.tipo === "EGRESO" ? "text-red-700" : "text-green-700"}>
                        {m.tipo === "EGRESO" ? "−" : "+"}
                        {formatoPesos(m.valor)}
                      </span>
                      {abierta && !m.anulado && (
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
            {abierta ? (
              <Formulario accion={registrarMovimientoCaja.bind(null, diaISO)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Tipo">
                    <select name="tipo" defaultValue="EGRESO">
                      <option value="EGRESO">Gasto o retiro</option>
                      <option value="INGRESO">Otro ingreso</option>
                    </select>
                  </Campo>
                  <Campo etiqueta="Medio">
                    <select name="medio" defaultValue="EFECTIVO">
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                    </select>
                  </Campo>
                </div>
                <Campo etiqueta="Concepto">
                  <input name="concepto" required placeholder="Ej.: gasolina, compra de cubetas, consignación" />
                </Campo>
                <Campo etiqueta="Valor">
                  <input name="valor" inputMode="numeric" required />
                </Campo>
                <Boton type="submit" variante="secundario">
                  Registrar
                </Boton>
              </Formulario>
            ) : (
              movimientos.length === 0 && <p className="text-sm text-stone-500">Sin movimientos.</p>
            )}
          </Tarjeta>

          {abierta && (
            <Tarjeta titulo="Base">
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
