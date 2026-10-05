import { Formulario } from "@/components/formulario";
import { Boton, Campo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { existencias } from "@/lib/existencias";
import { formatoCantidad, formatoFechaHora } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { registrarAjuste } from "./acciones";

const TIPO = { PRODUCCION: "Clasificación", VENTA: "Venta", AJUSTE: "Ajuste", ROTURA: "Rotura", ANULACION: "Anulación" } as const;

export default async function InventarioPage() {
  const sesion = await requerir("inventario.ver");
  const [productos, stock, movimientos] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    existencias(),
    db.movimientoInventario.findMany({
      orderBy: { id: "desc" },
      take: 50,
      include: { producto: true, usuario: true, venta: { include: { cliente: true } } },
    }),
  ]);

  return (
    <>
      <Titulo>Inventario</Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {productos.map((p) => {
          const cantidad = stock.get(p.id) ?? 0;
          return (
            <div key={p.id} className="rounded border border-stone-200 bg-white p-3">
              <p className="text-sm text-stone-600">{p.nombre}</p>
              <p className={`font-semibold ${cantidad < 0 ? "text-red-700" : ""}`}>{formatoCantidad(p.tipo, cantidad)}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="mb-2 font-semibold">Últimos movimientos</h2>
          <Tabla>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="text-right">Cantidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{formatoFechaHora(m.fecha)}</td>
                  <td>{m.producto.nombre}</td>
                  <td>{TIPO[m.tipo]}</td>
                  <td className={`whitespace-nowrap text-right ${m.cantidad < 0 ? "text-red-700" : "text-green-700"}`}>
                    {m.cantidad > 0 ? "+" : ""}
                    {formatoCantidad(m.producto.tipo, m.cantidad)}
                  </td>
                  <td className="text-stone-600">
                    {m.venta ? m.venta.cliente.nombre : m.nota}
                    {m.usuario && <span className="text-stone-400"> · {m.usuario.nombre}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>

        {puede(sesion.operacion, "inventario.ajustar") && (
          <Tarjeta titulo="Ajuste de inventario">
            <Formulario accion={registrarAjuste}>
              <Campo etiqueta="Producto">
                <select name="productoId" required>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Tipo" ayuda="Ajuste: corrige tras un conteo. Rotura: siempre resta.">
                  <select name="tipo">
                    <option value="AJUSTE">Ajuste</option>
                    <option value="ROTURA">Rotura (salida)</option>
                  </select>
                </Campo>
                <Campo etiqueta="Sentido" ayuda="Entrada suma, salida resta. En rotura no se usa.">
                  <select name="sentido">
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                  </select>
                </Campo>
                <Campo etiqueta="Cubetas o gallinas">
                  <input name="cantidad" inputMode="numeric" defaultValue="0" />
                </Campo>
                <Campo etiqueta="Huevos sueltos" ayuda="Los que no completan una cubeta de 30. No aplica a gallinas.">
                  <input name="sueltos" inputMode="numeric" defaultValue="0" />
                </Campo>
              </div>
              <Campo etiqueta="Motivo">
                <input name="nota" required placeholder="Conteo físico, cubetas rotas en bodega..." />
              </Campo>
              <Boton type="submit">Registrar ajuste</Boton>
            </Formulario>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
