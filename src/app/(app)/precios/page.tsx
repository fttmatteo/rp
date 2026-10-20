import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { Boton, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFechaHora, formatoPesos, nombreProducto, UNIDADES_GALLINAZA } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { PestanasContabilidad } from "@/components/secciones";
import { textoRangoGramos } from "@/modules/pesos";
import { guardarPreciosGenerales } from "./acciones";

export default async function PreciosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const sesion = await requerir("precios");
  const pagina = leerPagina((await searchParams).pagina);
  const [productos, historial, totalHistorial] = await Promise.all([
    db.producto.findMany({ orderBy: { orden: "asc" } }),
    db.historialPrecio.findMany({
      ...rango(pagina, 20),
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      include: { producto: { select: { nombre: true } }, cliente: { select: { nombre: true } } },
    }),
    db.historialPrecio.count(),
  ]);
  return (
    <>
      <Titulo>Precios</Titulo>
      <PestanasContabilidad actual="/precios" operacion={sesion.operacion} />
      <div className="space-y-6">
        <Formulario accion={guardarPreciosGenerales} id="generales">
          <Tabla>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio general</th>
                <th>Precio cliente sugerido</th>
                <th>Mínimo en bodega</th>
                <th>En venta</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    {p.tipo === "GALLINAZA" ? (
                      <label className="font-medium">
                        Gallinaza por
                        <select name={`unidad_${p.id}`} defaultValue={p.unidad ?? "bulto"} className="mt-1">
                          {UNIDADES_GALLINAZA.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      nombreProducto(p)
                    )}
                  </td>
                  <td>
                    <input name={`general_${p.id}`} inputMode="numeric" defaultValue={p.precioGeneral || ""} />
                  </td>
                  <td>
                    <input name={`sugerido_${p.id}`} inputMode="numeric" defaultValue={p.precioClienteSugerido ?? ""} />
                  </td>
                  <td>
                    <input
                      name={`minimo_${p.id}`}
                      inputMode="numeric"
                      defaultValue={p.minimo ?? ""}
                      placeholder={p.tipo === "CUBETA" ? "cubetas" : p.tipo === "GALLINA" ? "gallinas" : (p.unidad ?? "bulto") + "s"}
                    />
                  </td>
                  <td>
                    <input type="checkbox" name={`activo_${p.id}`} defaultChecked={p.activo} aria-label={`${p.nombre} en venta`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <p className="text-stone-600">
            El precio sugerido se propone al configurar los precios especiales de un cliente. Cada cliente puede tener el suyo. Un producto
            que no está en venta no aparece en pedidos ni en la clasificación. La gallinaza se vende, se clasifica y se cuenta en la unidad
            elegida; si cambias la unidad, ajusta su inventario. Si las existencias bajan del mínimo, Inicio muestra una alerta (déjalo vacío
            para no avisar).
          </p>
          <h2 className="pt-2 text-lg font-semibold">Peso de cada tipo de huevo</h2>
          <Tabla>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Desde (gramos)</th>
                <th>Hasta (gramos)</th>
                <th>Queda</th>
              </tr>
            </thead>
            <tbody>
              {productos
                .filter((p) => p.tipo === "CUBETA")
                .map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.nombre}</td>
                    <td>
                      <input name={`gramosMin_${p.id}`} inputMode="numeric" defaultValue={p.gramosMin ?? ""} aria-label={`${p.nombre} desde (gramos)`} />
                    </td>
                    <td>
                      <input name={`gramosMax_${p.id}`} inputMode="numeric" defaultValue={p.gramosMax ?? ""} aria-label={`${p.nombre} hasta (gramos)`} />
                    </td>
                    <td className="text-stone-600">{textoRangoGramos(p) ?? "Sin peso"}</td>
                  </tr>
                ))}
            </tbody>
          </Tabla>
          <p className="text-stone-600">
            El peso de un huevo, en gramos, decide su tipo. Se muestra en la clasificación como guía. Deja «Desde» vacío para «hasta tantos
            gramos» y «Hasta» vacío para «tantos gramos o más». Dos tipos no pueden compartir el mismo peso.
          </p>
          <Boton type="submit">Guardar precios y pesos</Boton>
        </Formulario>

        <Tarjeta id="cambios" titulo="Cambios de precio">
          {historial.length === 0 ? (
            <p className="text-stone-500">Sin cambios todavía.</p>
          ) : (
            <ul className="space-y-1">
              {historial.map((h) => (
                <li key={h.id}>
                  {formatoFechaHora(h.fecha)} · {h.producto.nombre}
                  {h.cliente ? ` (cliente ${h.cliente.nombre})` : " (general)"}:{" "}
                  {h.precioAnterior === null ? "—" : formatoPesos(h.precioAnterior)} →{" "}
                  {h.precioNuevo === null ? "sin precio especial" : formatoPesos(h.precioNuevo)}
                </li>
              ))}
            </ul>
          )}
          <Paginacion ruta="/precios" pagina={pagina} total={totalHistorial} porPagina={20} ancla="cambios" />
        </Tarjeta>
      </div>
    </>
  );
}
