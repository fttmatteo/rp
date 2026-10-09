import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { Boton, Campo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { existencias } from "@/lib/existencias";
import { formatoCantidad, formatoFechaHora, formatoHuevos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { registrarAjuste } from "./acciones";
import { PestanasInventario } from "./pestanas";

const TIPO = { PRODUCCION: "Clasificación", VENTA: "Venta", AJUSTE: "Ajuste", ROTURA: "Rotura", ANULACION: "Anulación", COMPRA: "Compra" } as const;

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const sesion = await requerir("inventario.ver");
  const pagina = leerPagina((await searchParams).pagina);
  const ajustar = puede(sesion.operacion, "inventario.ajustar");
  const [productos, stock, movimientos, totalMovimientos, porClasificar] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    existencias(),
    db.movimientoInventario.findMany({
      orderBy: { id: "desc" },
      ...rango(pagina),
      include: {
        producto: true,
        usuario: { select: { nombre: true } },
        venta: { select: { cliente: { select: { nombre: true } } } },
        compra: { select: { id: true, proveedor: { select: { nombre: true } } } },
      },
    }),
    db.movimientoInventario.count(),
    db.compra.aggregate({ where: { anulada: false }, _sum: { porClasificar: true } }),
  ]);
  const sinClasificar = porClasificar._sum.porClasificar ?? 0;

  return (
    <>
      <Titulo>Inventario</Titulo>
      <PestanasInventario actual="/inventario" operacion={sesion.operacion} />
      <div id="existencias" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {productos.map((p) => {
          const cantidad = stock.get(p.id) ?? 0;
          return (
            <div key={p.id} className="rounded border border-stone-200 bg-white p-3">
              <p className="text-stone-600">{p.nombre}</p>
              <p className={`font-semibold tabular-nums ${cantidad < 0 ? "text-red-700" : ""}`}>{formatoCantidad(p.tipo, cantidad, p.unidad)}</p>
              {/* El rojo nunca va solo: dice por qué. */}
              {cantidad < 0 && <p className="text-sm font-medium text-red-700">Bajo cero</p>}
            </div>
          );
        })}
        {sinClasificar > 0 && (
          <div className="rounded border border-blue-300 bg-blue-50 p-3 text-blue-800">
            <p>Comprado por clasificar</p>
            <p className="font-semibold tabular-nums">{formatoHuevos(sinClasificar)}</p>
          </div>
        )}
      </div>

      {/* El ajuste va en una fila sobre los movimientos; así la tabla usa todo el ancho y cada movimiento cabe en una línea. */}
      {ajustar && (
        <Tarjeta id="ajuste" titulo="Ajuste de inventario" className="mb-6">
          <Formulario accion={registrarAjuste} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Campo etiqueta="Producto">
                <select name="productoId" required>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
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
              <Campo etiqueta="Cubetas, gallinas o gallinaza">
                <input name="cantidad" inputMode="numeric" defaultValue="0" />
              </Campo>
              <Campo etiqueta="Huevos sueltos" ayuda="Los que no completan una cubeta de 30. No aplica a gallinas.">
                <input name="sueltos" inputMode="numeric" defaultValue="0" />
              </Campo>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <Campo etiqueta="Motivo">
                  <input name="nota" required placeholder="Conteo físico, cubetas rotas en bodega..." />
                </Campo>
              </div>
              <Boton type="submit">Registrar ajuste</Boton>
            </div>
          </Formulario>
        </Tarjeta>
      )}

      <div>
        <h2 id="movimientos" className="mb-2 text-lg font-semibold">
          Movimientos
        </h2>
        <Tabla>
          <thead>
            <tr>
              {/* En el celular quedan Producto (con la fecha, el tipo y el detalle debajo) y Cantidad. */}
              <th className="hidden sm:table-cell">Fecha</th>
              <th>Producto</th>
              <th className="hidden sm:table-cell">Tipo</th>
              <th className="text-right">Cantidad</th>
              <th className="hidden sm:table-cell">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id}>
                <td className="hidden whitespace-nowrap sm:table-cell">{formatoFechaHora(m.fecha)}</td>
                <td>
                  {m.producto.nombre}
                  <span className="block text-stone-600 sm:hidden">
                    {formatoFechaHora(m.fecha)} · {TIPO[m.tipo]}
                  </span>
                  <span className="block text-stone-600 sm:hidden">
                    {m.venta ? m.venta.cliente.nombre : m.compra && !m.nota ? `Compra #${m.compra.id} a ${m.compra.proveedor.nombre}` : m.nota}
                  </span>
                </td>
                <td className="hidden sm:table-cell">{TIPO[m.tipo]}</td>
                <td className={`whitespace-nowrap text-right tabular-nums ${m.cantidad < 0 ? "text-red-700" : "text-green-700"}`}>
                  {m.cantidad > 0 ? "+" : ""}
                  {formatoCantidad(m.producto.tipo, m.cantidad, m.producto.unidad)}
                </td>
                <td className="hidden text-stone-600 sm:table-cell">
                  {m.venta ? m.venta.cliente.nombre : m.compra && !m.nota ? `Compra #${m.compra.id} a ${m.compra.proveedor.nombre}` : m.nota}
                  {m.usuario && <span className="text-stone-500"> · {m.usuario.nombre}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
        <Paginacion ruta="/inventario" pagina={pagina} total={totalMovimientos} ancla="movimientos" />
      </div>
    </>
  );
}
