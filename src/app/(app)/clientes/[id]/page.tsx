import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, EtiquetaInactivo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { actualizarCliente, guardarPreciosCliente } from "../acciones";
import { CamposCliente } from "../campos";

/** Datos y precios del cliente. Lo que debe y sus pagos están en Contabilidad > Cartera. */
export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  const sesion = await requerir("clientes.ver");
  const id = Number((await params).id);
  const { creado } = await searchParams;
  const cliente = Number.isInteger(id)
    ? await db.cliente.findUnique({ where: { id }, include: { precios: true } })
    : null;
  if (!cliente) notFound();
  const productos = await db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } });
  const especiales = new Map(cliente.precios.map((p) => [p.productoId, p.precio]));
  const op = sesion.operacion;

  return (
    <>
      {/* Lo que más se hace con un cliente (tomarle un pedido, ver lo que debe) queda a mano, como en su cartera. */}
      <Titulo
        accion={
          <div className="flex flex-wrap gap-2">
            {puede(op, "pedidos.crear") && cliente.activo && <BotonLink href={`/pedidos/nuevo?cliente=${id}`}>Nuevo pedido</BotonLink>}
            {puede(op, "cartera.ver") && (
              <BotonLink href={`/cartera/${id}`} variante="secundario">
                Ver cartera
              </BotonLink>
            )}
            <BotonLink href="/clientes" variante="secundario">
              Volver
            </BotonLink>
          </div>
        }
      >
        {cliente.nombre} {!cliente.activo && <EtiquetaInactivo />}
      </Titulo>
      {creado && (
        <div className="mb-4">
          <Alerta tipo="ok">
            Cliente creado.{" "}
            {puede(op, "pedidos.crear") && (
              <>
                Ya puedes{" "}
                <Link href={`/pedidos/nuevo?cliente=${id}`} className="underline">
                  tomarle un pedido
                </Link>
                .{" "}
              </>
            )}
            {puede(op, "anular") && (
              <>
                Si ya debía algo, carga su saldo inicial en{" "}
                <Link href={`/cartera/${id}#saldo-inicial`} className="underline">
                  Cartera
                </Link>
                .
              </>
            )}
          </Alerta>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Tarjeta id="datos" titulo="Datos del cliente">
          {puede(op, "clientes.editar") ? (
            <Formulario accion={actualizarCliente.bind(null, id)}>
              <CamposCliente c={cliente} />
              <label className="flex min-h-11 items-center gap-2 font-normal">
                <input type="checkbox" name="activo" defaultChecked={cliente.activo} /> Cliente activo
              </label>
              <Boton type="submit">Guardar</Boton>
            </Formulario>
          ) : (
            <dl className="space-y-1">
              <div>Dirección: {cliente.direccion ?? "—"}</div>
              <div>Zona: {cliente.zona ?? "—"}</div>
              <div>Notas: {cliente.notas ?? "—"}</div>
            </dl>
          )}
        </Tarjeta>

        <Tarjeta id="precios" titulo="Precios">
          {puede(op, "precios") ? (
            <Formulario accion={guardarPreciosCliente.bind(null, id)}>
              <Tabla>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>General</th>
                    <th>Especial</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="whitespace-nowrap tabular-nums">{formatoPesos(p.precioGeneral)}</td>
                      <td>
                        {/* Precio con que se abrió la página: si otra persona guarda mientras tanto, no se pisa su cambio. */}
                        <input type="hidden" name={`antes_precio_${p.id}`} defaultValue={especiales.get(p.id) ?? ""} />
                        <input
                          name={`precio_${p.id}`}
                          inputMode="numeric"
                          defaultValue={especiales.get(p.id) ?? ""}
                          placeholder={p.precioClienteSugerido ? `Sugerido ${p.precioClienteSugerido}` : "General"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
              <p className="text-stone-500">Vacío = paga el precio general.</p>
              <Boton type="submit">Guardar precios</Boton>
            </Formulario>
          ) : (
            <ul className="space-y-1">
              {productos.map((p) => (
                <li key={p.id}>
                  {p.nombre}: {formatoPesos(especiales.get(p.id) ?? p.precioGeneral)}
                  {especiales.has(p.id) && " (especial)"}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

      </div>
      <p className="mt-6 text-stone-500">Cliente desde {formatoFecha(cliente.creadoEn)}</p>
    </>
  );
}
