import { Formulario } from "@/components/formulario";
import { Boton, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoCantidad, formatoDia, formatoHuevos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { anularClasificacion, registrarClasificacion } from "./acciones";

export default async function ClasificacionPage() {
  const sesion = await requerir("clasificacion");
  const [productos, registros, compras] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.registroClasificacion.findMany({
      orderBy: { id: "desc" },
      take: 20,
      include: {
        usuario: true,
        compra: { include: { proveedor: true } },
        detalles: { include: { producto: true } },
        movimientos: { where: { tipo: "ANULACION" }, take: 1 },
      },
    }),
    db.compra.findMany({ where: { anulada: false, porClasificar: { gt: 0 } }, orderBy: { fecha: "asc" }, include: { proveedor: true } }),
  ]);
  const huevos = productos.filter((p) => p.tipo === "CUBETA");
  const gallinas = productos.filter((p) => p.tipo === "GALLINA");
  const gallinaza = productos.filter((p) => p.tipo === "GALLINAZA");

  return (
    <>
      <Titulo>Clasificación diaria</Titulo>
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Registrar clasificación">
          <Formulario accion={registrarClasificacion}>
            <Campo etiqueta="Fecha">
              <input name="fecha" type="date" defaultValue={hoyISO()} max={hoyISO()} required />
            </Campo>
            {compras.length > 0 && (
              <Campo etiqueta="Origen del huevo" ayuda="Elige la compra si estás clasificando huevo comprado que llegó sin clasificar.">
                <select name="origen" defaultValue="">
                  <option value="">Producción propia</option>
                  {compras.map((c) => (
                    <option key={c.id} value={c.id}>
                      Compra #{c.id} a {c.proveedor.nombre} · faltan {formatoHuevos(c.porClasificar)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Tabla>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cubetas</th>
                  <th>Huevos sueltos (sin completar cubeta)</th>
                </tr>
              </thead>
              <tbody>
                {huevos.map((p) => (
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
            <div className="grid grid-cols-2 gap-3">
              {gallinas.map((p) => (
                <Campo key={p.id} etiqueta="Gallinas pasadas a venta" ayuda="Salen del galpón y suman al inventario para vender.">
                  <input name={`unidades_${p.id}`} inputMode="numeric" placeholder="0" />
                </Campo>
              ))}
              {gallinaza.map((p) => (
                <Campo key={p.id} etiqueta={`Gallinaza recogida (${p.unidad ?? "bulto"}s)`} ayuda="Suma al inventario de gallinaza para vender.">
                  <input name={`unidades_${p.id}`} inputMode="numeric" placeholder="0" />
                </Campo>
              ))}
              <Campo etiqueta="Huevos rotos" ayuda="Solo como registro; no entran al inventario.">
                <input name="rotos" inputMode="numeric" placeholder="0" />
              </Campo>
            </div>
            <Campo etiqueta="Nota">
              <input name="nota" />
            </Campo>
            <Boton type="submit">Guardar</Boton>
          </Formulario>
        </Tarjeta>

        <div>
          <h2 className="mb-2 font-semibold">Registros recientes</h2>
          <ul className="space-y-2">
            {registros.map((r) => (
              <li key={r.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {formatoDia(r.fecha)}
                    {r.compra && <span className="font-normal text-stone-600"> · compra #{r.compra.id} a {r.compra.proveedor.nombre}</span>}
                  </strong>
                  <span className="text-stone-500">
                    {r.usuario.nombre} {r.movimientos.length > 0 && <Etiqueta color="rojo">Anulado</Etiqueta>}
                  </span>
                </div>
                <p>
                  {r.detalles.map((d) => `${d.producto.nombre}: ${formatoCantidad(d.producto.tipo, d.cantidad, d.producto.unidad)}`).join(" · ")}
                </p>
                {r.rotos > 0 && <p className="text-stone-500">Rotos: {r.rotos}</p>}
                {r.nota && <p className="text-stone-500">{r.nota}</p>}
                {puede(sesion.operacion, "anular") && r.movimientos.length === 0 && (
                  <Formulario accion={anularClasificacion.bind(null, r.id)} confirmar="¿Anular este registro? Sus cantidades salen del inventario." className="mt-1">
                    <button type="submit" className="text-xs text-red-700 underline">
                      Anular registro
                    </button>
                  </Formulario>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
