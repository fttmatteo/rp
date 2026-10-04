import { Formulario } from "@/components/formulario";
import { Boton, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { guardarPreciosGenerales } from "./acciones";

export default async function PreciosPage() {
  await requerir("precios");
  const [productos, historial] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.historialPrecio.findMany({ take: 20, orderBy: { fecha: "desc" }, include: { producto: true, cliente: true } }),
  ]);
  return (
    <>
      <Titulo>Precios</Titulo>
      <div className="space-y-6">
        <Formulario accion={guardarPreciosGenerales}>
          <Tabla>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio general</th>
                <th>Precio cliente sugerido</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.tipo === "CUBETA" ? `Cubeta ${p.nombre}` : p.nombre}</td>
                  <td>
                    <input name={`general_${p.id}`} inputMode="numeric" defaultValue={p.precioGeneral} required />
                  </td>
                  <td>
                    <input name={`sugerido_${p.id}`} inputMode="numeric" defaultValue={p.precioClienteSugerido ?? ""} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <p className="text-sm text-stone-600">
            El precio sugerido se propone al configurar los precios especiales de un cliente. Cada cliente puede tener el suyo.
          </p>
          <Boton type="submit">Guardar precios</Boton>
        </Formulario>

        <Tarjeta titulo="Últimos cambios de precio">
          {historial.length === 0 ? (
            <p className="text-sm text-stone-500">Sin cambios todavía.</p>
          ) : (
            <ul className="space-y-1 text-sm">
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
        </Tarjeta>
      </div>
    </>
  );
}
