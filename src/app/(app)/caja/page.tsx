import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Alerta, Boton, BotonLink, BotonTexto, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { obtenerCaja, totalesCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { diaUTC, formatoConsecutivo, formatoDia, formatoFechaHora, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { PestanasContabilidad } from "@/components/secciones";
import { SelectorDiaCaja } from "@/components/dinero";
import { efectivoEsperado, totalTransferencias } from "@/modules/caja";
import { actualizarBase, anularMovimientoCaja, cerrarCaja, reabrirCaja, verificarTransferencia } from "./acciones";

function Fila({ texto, valor, fuerte, signo }: { texto: string; valor: number; fuerte?: boolean; signo?: "+" | "−" }) {
  return (
    <div className={`flex justify-between py-1 ${fuerte ? "border-t border-stone-200 pt-2 font-semibold" : ""}`}>
      <span>{texto}</span>
      <span className="whitespace-nowrap tabular-nums">
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
      <BotonTexto type="submit" className="text-stone-600">
        Quitar
      </BotonTexto>
    </Formulario>
  ) : (
    <Formulario accion={verificarTransferencia.bind(null, entidad, id, true)} className="inline">
      <Etiqueta color="azul">Sin verificar</Etiqueta>{" "}
      <BotonTexto type="submit">Ya llegó al banco</BotonTexto>
    </Formulario>
  );
}

function MedioCobro({ p }: { p: { id: number; medio: string; anulado: boolean; verificadoEn: Date | null } }) {
  return (
    <>
      {p.medio === "EFECTIVO" ? "Efectivo" : "Transferencia"}{" "}
      {p.medio === "TRANSFERENCIA" && !p.anulado && <Verificacion entidad="Pago" id={p.id} verificadoEn={p.verificadoEn} />}
    </>
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

  const avisos = [
    sinCerrar.length > 0 && {
      texto: "Días sin cerrar",
      dias: sinCerrar.map((c) => c.dia.toISOString().slice(0, 10)),
    },
    diasSinVerificar.length > 0 && { texto: "Transferencias sin verificar en el banco", dias: diasSinVerificar },
  ].filter((a): a is { texto: string; dias: string[] } => !!a);

  return (
    <>
      <Titulo
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <SelectorDiaCaja ruta="/caja" diaISO={diaISO} />
            <BotonLink href="/caja/reporte" variante="secundario">
              Reporte quincenal
            </BotonLink>
          </div>
        }
      >
        Caja del {formatoDia(dia)}{" "}
        <Etiqueta color={abierta ? "azul" : "verde"}>{abierta ? "Abierta" : "Cerrada"}</Etiqueta>
      </Titulo>
      <PestanasContabilidad actual="/caja" operacion={sesion.operacion} dia={diaISO} />

      {avisos.length > 0 && (
        <div className="mb-4 space-y-2">
          {avisos.map((a) => (
            <Alerta key={a.texto} tipo="aviso">
              {a.texto}:{" "}
              {a.dias.map((d, i) => (
                <span key={d}>
                  {i > 0 && ", "}
                  <Link href={`/caja?dia=${d}`} className="underline">
                    {formatoDia(diaUTC(d))}
                  </Link>
                </span>
              ))}
            </Alerta>
          ))}
        </div>
      )}

      {/* Arriba el cuadre del día (efectivo, transferencias y cierre) en una sola fila; abajo el detalle. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Tarjeta id="efectivo" titulo="Efectivo">
          <Fila texto="Base (al empezar)" valor={totales.base} />
          <Fila texto="Cobros" valor={totales.cobrosEfectivo} signo="+" />
          <Fila texto="Otros ingresos" valor={totales.ingresosEfectivo} signo="+" />
          <Fila texto="Gastos y retiros" valor={totales.egresosEfectivo} signo="−" />
          <Fila texto="Efectivo esperado" valor={esperado} fuerte />
          {!abierta && (
            <>
              <Fila texto="Efectivo contado" valor={caja.contado ?? 0} />
              <div className={`flex justify-between py-1 font-semibold ${caja.diferencia ? "text-red-700" : "text-green-700"}`}>
                <span>Diferencia</span>
                <span className="tabular-nums">{caja.diferencia === 0 ? "Cuadrada" : formatoPesos(caja.diferencia ?? 0)}</span>
              </div>
            </>
          )}
          {abierta && (
            <details className="mt-2">
              <summary className="block cursor-pointer py-2.5 text-stone-600 underline">Corregir la base</summary>
              <Formulario accion={actualizarBase.bind(null, diaISO)} className="mt-2 space-y-2">
                <p className="text-sm text-stone-500">Se toma del efectivo contado en el último cierre. Corrígela si no coincide.</p>
                <div className="flex gap-2">
                  <input name="base" inputMode="numeric" defaultValue={caja.base} required aria-label="Base" />
                  <Boton type="submit" variante="secundario">
                    Guardar
                  </Boton>
                </div>
              </Formulario>
            </details>
          )}
        </Tarjeta>

        <Tarjeta id="transferencias" titulo="Transferencias (no se cuentan)">
          <Fila texto="Cobros" valor={totales.cobrosTransferencia} />
          <Fila texto="Otros ingresos" valor={totales.ingresosTransferencia} signo="+" />
          <Fila texto="Gastos" valor={totales.egresosTransferencia} signo="−" />
          <Fila texto="Neto en transferencias" valor={totalTransferencias(totales)} fuerte />
          {hayPendienteHoy && (
            <p className="pt-1 font-medium text-blue-800">
              Falta confirmar en el banco un neto de {formatoPesos(pendienteHoy)}. Márcalas abajo cuando las veas en la cuenta.
            </p>
          )}
        </Tarjeta>

        {abierta ? (
          <Tarjeta id="cierre" titulo="Cerrar caja">
            <Formulario accion={cerrarCaja.bind(null, diaISO)} className="space-y-3" confirmar="¿Cerrar la caja de este día? Después solo el administrador puede reabrirla.">
              <p className="text-stone-600">
                Cuenta el efectivo que hay en caja. El sistema espera <strong>{formatoPesos(esperado)}</strong>.
              </p>
              <Campo etiqueta="Efectivo contado" ayuda="Billetes y monedas, incluida la base.">
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
            <p>
              Cerrada por {cerradaPor?.nombre ?? "—"}
              {caja.cerradaEn && ` el ${formatoFechaHora(caja.cerradaEn)}`}
            </p>
            {caja.observacion && <p className="mt-1 text-stone-600">Observación: {caja.observacion}</p>}
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

      {/* Los otros movimientos son pocos y van primero; los cobros, que son muchos, en una tabla a todo el ancho. */}
      <Tarjeta id="movimientos" titulo={`Otros ingresos, compras y gastos (${movimientos.length})`} className="mb-6">
        {movimientos.length > 0 && (
          <ul className="mb-4 divide-y divide-stone-100">
            {movimientos.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  {m.tipo === "INGRESO" ? "Ingreso" : m.compraId ? "Compra" : m.pagoProveedorId ? "Pago a proveedor" : "Gasto"}: {m.concepto} ·{" "}
                  {m.medio === "EFECTIVO" ? "efectivo" : "transferencia"}
                  <span className="text-stone-500"> · {m.usuario.nombre}</span> {m.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                  {m.medio === "TRANSFERENCIA" && !m.anulado && <Verificacion entidad="MovimientoCaja" id={m.id} verificadoEn={m.verificadoEn} />}
                </span>
                <span className="flex shrink-0 items-start gap-2">
                  <span className={`whitespace-nowrap tabular-nums ${m.anulado ? "text-stone-500 line-through" : m.tipo === "EGRESO" ? "text-red-700" : "text-green-700"}`}>
                    {m.tipo === "EGRESO" ? "−" : "+"}
                    {formatoPesos(m.valor)}
                  </span>
                  {abierta && !m.anulado && !m.rutaId && !m.compraId && !m.pagoProveedorId && (
                    <Formulario accion={anularMovimientoCaja.bind(null, m.id)} className="inline" confirmar="¿Anular este movimiento?">
                      <BotonTexto type="submit" peligro>
                        Anular
                      </BotonTexto>
                    </Formulario>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {movimientos.length === 0 && <p className="mb-2 text-stone-500">Sin movimientos.</p>}
        <p className="text-stone-600">
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
      <Tarjeta id="cobros" titulo={`Cobros del día (${pagos.length})`}>
        {pagos.length === 0 ? (
          <p className="text-stone-500">Sin cobros.</p>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Recibo</th>
                <th>Cliente</th>
                <th className="hidden sm:table-cell">Medio</th>
                <th className="hidden sm:table-cell">Registró</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {paginar(pagos, pagina).map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    <a href={`/recibos/pago/${p.id}`} target="_blank" className="underline">
                      {formatoConsecutivo("AB", p.consecutivo)}
                    </a>{" "}
                    {p.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                  </td>
                  <td>
                    {p.cliente.nombre}
                    {/* En el celular el medio va debajo del cliente para que el valor quepa sin desplazar la tabla. */}
                    <span className="block sm:hidden">
                      <MedioCobro p={p} />
                    </span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <MedioCobro p={p} />
                  </td>
                  <td className="hidden text-stone-500 sm:table-cell">{p.usuario.nombre}</td>
                  <td className={`whitespace-nowrap text-right tabular-nums ${p.anulado ? "text-stone-500 line-through" : ""}`}>{formatoPesos(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
        <Paginacion ruta="/caja" params={{ dia: diaISO }} pagina={pagina} total={pagos.length} ancla="cobros" />
      </Tarjeta>
    </>
  );
}
