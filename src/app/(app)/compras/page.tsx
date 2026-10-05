import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFecha, formatoHuevos, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { anularCompra, registrarCompra } from "./acciones";

export default async function ComprasPage() {
  const sesion = await requerir("compras");
  const [proveedores, tipos, compras] = await Promise.all([
    db.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.producto.findMany({ where: { tipo: "CUBETA" }, orderBy: { orden: "asc" } }),
    db.compra.findMany({ orderBy: { id: "desc" }, take: 50, include: { proveedor: true, detalles: { include: { producto: true } } } }),
  ]);

  return (
    <>
      <Titulo
        accion={
          <BotonLink href="/proveedores" variante="secundario">
            Proveedores y cuentas por pagar
          </BotonLink>
        }
      >
        Compras de huevo
      </Titulo>
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Tarjeta titulo="Registrar compra">
          {proveedores.length === 0 ? (
            <p className="text-sm text-stone-600">
              Primero crea el proveedor en{" "}
              <Link href="/proveedores" className="underline">
                Proveedores
              </Link>
              .
            </p>
          ) : (
            <Formulario accion={registrarCompra}>
              <Campo etiqueta="Proveedor">
                <select name="proveedorId" required>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-stone-700">¿Cómo llegó el huevo?</legend>
                <label className="flex items-center gap-2 font-normal">
                  <input type="radio" name="ingreso" value="CLASIFICADA" defaultChecked /> Ya clasificado: suma directo al inventario por
                  tipo
                </label>
                <label className="flex items-center gap-2 font-normal">
                  <input type="radio" name="ingreso" value="SIN_CLASIFICAR" /> Sin clasificar: queda por clasificar en Clasificación
                </label>
              </fieldset>

              <details open className="rounded border border-stone-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">Si llegó clasificado: cantidad por tipo</summary>
                <Tabla>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Cubetas</th>
                      <th>Huevos sueltos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tipos.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.nombre}</td>
                        <td>
                          <input name={`cubetas_${p.id}`} inputMode="numeric" placeholder="0" />
                        </td>
                        <td>
                          <input name={`sueltos_${p.id}`} inputMode="numeric" placeholder="0" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              </details>
              <details className="rounded border border-stone-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">Si llegó sin clasificar: cantidad total</summary>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Campo etiqueta="Cubetas">
                    <input name="cubetas" inputMode="numeric" placeholder="0" />
                  </Campo>
                  <Campo etiqueta="Huevos sueltos">
                    <input name="sueltos" inputMode="numeric" placeholder="0" />
                  </Campo>
                </div>
              </details>

              <Campo etiqueta="Costo total" ayuda="Lo que se le paga al proveedor por toda la compra.">
                <input name="total" inputMode="numeric" required />
              </Campo>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-stone-700">Pago al proveedor</legend>
                <label className="flex items-center gap-2 font-normal">
                  <input type="radio" name="formaPago" value="CONTADO" defaultChecked /> De contado: sale de la caja de hoy
                </label>
                <label className="flex items-center gap-2 font-normal">
                  <input type="radio" name="formaPago" value="CREDITO" /> A crédito: queda como cuenta por pagar
                </label>
              </fieldset>
              <Campo etiqueta="Medio (si es de contado)">
                <select name="medio" defaultValue="EFECTIVO">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </Campo>
              <Campo etiqueta="Nota">
                <input name="nota" />
              </Campo>
              <Boton type="submit">Registrar compra</Boton>
            </Formulario>
          )}
        </Tarjeta>

        <div>
          <h2 className="mb-2 font-semibold">Últimas compras</h2>
          {compras.length === 0 ? (
            <Vacio>Todavía no hay compras.</Vacio>
          ) : (
            <ul className="space-y-2">
              {compras.map((c) => (
                <li key={c.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>#{c.id}</strong> · {formatoFecha(c.fecha)} ·{" "}
                      <Link href={`/proveedores/${c.proveedorId}`} className="underline">
                        {c.proveedor.nombre}
                      </Link>{" "}
                      {c.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
                    </span>
                    <strong>{formatoPesos(c.total)}</strong>
                  </div>
                  <p>
                    {c.clasificada
                      ? c.detalles.map((d) => `${d.producto.nombre}: ${formatoHuevos(d.cantidad)}`).join(" · ")
                      : `Sin clasificar: ${formatoHuevos(c.huevos)}`}
                    {!c.anulada && !c.clasificada && c.porClasificar > 0 && (
                      <>
                        {" "}
                        <Etiqueta color="ambar">Faltan {formatoHuevos(c.porClasificar)} por clasificar</Etiqueta>
                      </>
                    )}
                  </p>
                  <p className="text-stone-600">
                    {c.formaPago === "CONTADO" ? "De contado" : `A crédito · debe ${formatoPesos(c.saldo)}`}
                    {c.nota && ` · ${c.nota}`}
                  </p>
                  {!c.anulada && puede(sesion.operacion, "anular") && (
                    <Formulario
                      accion={anularCompra.bind(null, c.id)}
                      confirmar="¿Anular esta compra? Sale del inventario y se devuelve el dinero a la caja."
                      className="mt-1"
                    >
                      <button type="submit" className="text-xs text-red-700 underline">
                        Anular compra
                      </button>
                    </Formulario>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
