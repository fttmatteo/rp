import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion } from "@/components/paginacion";
import { Boton, BotonLink, BotonTexto, Campo, claseBoton, Etiqueta, EtiquetaInactivo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoDia, formatoFecha, formatoHuevos, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { comprasPorPagar } from "@/lib/proveedores-db";
import { requerir } from "@/lib/sesion";
import { anularPagoProveedor, registrarAbonoProveedor } from "../acciones";

const MOVIMIENTOS = 20;

/** Lo que le debemos a un proveedor y lo que le hemos pagado. Sus datos se editan en Usuarios > Proveedores. */
export default async function PorPagarProveedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const sesion = await requerir("compras");
  const pagina = leerPagina((await searchParams).pagina);
  // Compras y abonos van juntos por fecha: para la página N basta con las N páginas más recientes de cada uno.
  const hastaAqui = pagina * MOVIMIENTOS;
  const id = Number((await params).id);
  const proveedor = Number.isInteger(id) ? await db.proveedor.findUnique({ where: { id } }) : null;
  if (!proveedor) notFound();
  const [deudas, compras, pagos] = await Promise.all([
    comprasPorPagar(id),
    db.compra.findMany({ where: { proveedorId: id }, orderBy: [{ fecha: "desc" }, { id: "desc" }], take: hastaAqui }),
    db.pagoProveedor.findMany({
      where: { proveedorId: id },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: hastaAqui,
      include: { usuario: { select: { nombre: true } } },
    }),
  ]);
  const [totalCompras, totalPagos] = await Promise.all([
    db.compra.count({ where: { proveedorId: id } }),
    db.pagoProveedor.count({ where: { proveedorId: id } }),
  ]);
  const saldo = deudas.reduce((s, d) => s + d.saldo, 0);
  const hoy = diaUTC(hoyISO());

  return (
    <>
      <Titulo
        accion={
          <BotonLink href="/por-pagar" variante="secundario">
            Volver
          </BotonLink>
        }
      >
        {proveedor.nombre} {!proveedor.activo && <EtiquetaInactivo />}
      </Titulo>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <p>
          <span className="text-stone-600">Le debemos: </span>
          <span className={`text-2xl font-semibold tabular-nums ${saldo > 0 ? "text-red-700" : ""}`}>{formatoPesos(saldo)}</span>
        </p>
        <Link href={`/proveedores/${id}`} className={claseBoton("secundario")}>
          Editar datos del proveedor
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Tarjeta id="por-pagar" titulo="Cuentas por pagar">
          {deudas.length === 0 ? (
            <p className="text-stone-500">No le debemos nada.</p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Fecha</th>
                  <th>Vence</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {deudas.map((d) => (
                  <tr key={d.id}>
                    <td>#{d.id}</td>
                    <td>{formatoFecha(d.fecha)}</td>
                    <td>
                      {d.vence ? formatoDia(d.vence) : "—"} {d.vence && d.vence < hoy && <Etiqueta color="rojo">Vencida</Etiqueta>}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatoPesos(d.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          {saldo > 0 && (
            <Formulario accion={registrarAbonoProveedor.bind(null, id)} className="mt-4 space-y-3">
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
              <Campo etiqueta="Aplicar a" ayuda="Si sobra después de la compra elegida, va a la más antigua. Sale de la caja de hoy.">
                <select name="compra" defaultValue="">
                  <option value="">La compra más antigua primero</option>
                  {deudas.map((d) => (
                    <option key={d.id} value={d.id}>
                      Compra #{d.id} · {formatoFecha(d.fecha)} · debe {formatoPesos(d.saldo)}
                    </option>
                  ))}
                </select>
              </Campo>
              <Boton type="submit">Registrar abono</Boton>
            </Formulario>
          )}
        </Tarjeta>

        <Tarjeta id="movimientos" titulo="Movimientos">
          <ul className="divide-y divide-stone-100">
            {[...compras.map((c) => ({ fecha: c.fecha, c })), ...pagos.map((p) => ({ fecha: p.fecha, p }))]
              .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
              .slice(hastaAqui - MOVIMIENTOS, hastaAqui)
              .map((m) =>
                "c" in m ? (
                  <li key={`c${m.c.id}`} className="flex justify-between gap-2 py-2">
                    <span>
                      {formatoFecha(m.fecha)} · Compra #{m.c.id} ({formatoHuevos(m.c.huevos)},{" "}
                      {m.c.formaPago === "CONTADO" ? "contado" : "crédito"}) {m.c.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">{formatoPesos(m.c.total)}</span>
                  </li>
                ) : (
                  <li key={`p${m.p.id}`} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {formatoFecha(m.fecha)} · Abono ({m.p.medio === "EFECTIVO" ? "efectivo" : "transferencia"}) · {m.p.usuario.nombre}{" "}
                      {m.p.anulado && <Etiqueta color="rojo">Anulado</Etiqueta>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-green-700 tabular-nums">−{formatoPesos(m.p.valor)}</span>
                      {!m.p.anulado && puede(sesion.operacion, "anular") && (
                        <Formulario
                          accion={anularPagoProveedor.bind(null, m.p.id)}
                          confirmar="¿Anular este abono? El dinero vuelve a la caja."
                          className="inline"
                        >
                          <BotonTexto type="submit" peligro>
                            Anular
                          </BotonTexto>
                        </Formulario>
                      )}
                    </span>
                  </li>
                ),
              )}
          </ul>
          <Paginacion ruta={`/por-pagar/${id}`} pagina={pagina} total={totalCompras + totalPagos} porPagina={MOVIMIENTOS} ancla="movimientos" />
        </Tarjeta>

      </div>
    </>
  );
}
