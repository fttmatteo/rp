import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Alerta, Boton, BotonLink, Campo, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { saldoCliente } from "@/lib/cartera-db";
import { db } from "@/lib/db";
import { formatoPesos, hoyISO, nombreProducto } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { precioParaCliente } from "@/modules/precios";
import { crearPedido } from "../acciones";

export default async function NuevoPedidoPage({ searchParams }: { searchParams: Promise<{ cliente?: string; q?: string }> }) {
  await requerir("pedidos.crear");
  const { cliente: clienteParam, q = "" } = await searchParams;
  const clienteId = Number(clienteParam);
  const cliente = Number.isInteger(clienteId) && clienteId > 0
    ? await db.cliente.findFirst({ where: { id: clienteId, activo: true }, include: { precios: true } })
    : null;

  if (!cliente) {
    const clientes = await db.cliente.findMany({
      where: { activo: true, ...(q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { telefono: { contains: q } }] } : {}) },
      orderBy: { nombre: "asc" },
      take: 50,
    });
    return (
      <>
        <Titulo accion={<BotonLink href="/pedidos" variante="secundario">Volver</BotonLink>}>Nuevo pedido: elige el cliente</Titulo>
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar cliente" className="max-w-sm" autoFocus />
          <button type="submit" className="rounded border border-stone-300 bg-white px-4 py-2">
            Buscar
          </button>
        </form>
        <ul className="divide-y divide-stone-100 rounded border border-stone-200 bg-white">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="block px-4 py-3 hover:bg-stone-50">
                {c.nombre} <span className="text-sm text-stone-500">{[c.zona, c.telefono].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          ))}
          {clientes.length === 0 && <li className="px-4 py-3 text-sm text-stone-500">Sin resultados.</li>}
        </ul>
      </>
    );
  }

  const [productos, saldo] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    saldoCliente(cliente.id),
  ]);
  const especiales = new Map(cliente.precios.map((p) => [p.productoId, p.precio]));

  return (
    <>
      <Titulo accion={<BotonLink href="/pedidos/nuevo" variante="secundario">Cambiar cliente</BotonLink>}>
        Nuevo pedido: {cliente.nombre}
      </Titulo>
      <div className="max-w-2xl space-y-4">
        {saldo > 0 && (
          <Alerta tipo="aviso">
            Este cliente debe {formatoPesos(saldo)}.
            {cliente.cupoCredito !== null && saldo >= cliente.cupoCredito && " Ya llegó a su cupo de crédito."}
          </Alerta>
        )}
        <Tarjeta>
          <Formulario accion={crearPedido.bind(null, cliente.id)}>
            <Campo etiqueta="Fecha de entrega" ayuda="Puede ser hoy o un día futuro. El pedido aparece en el reparto de esa fecha.">
              <input type="date" name="fechaEntrega" defaultValue={hoyISO()} min={hoyISO()} required />
            </Campo>
            <Tabla>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const precio = precioParaCliente({ productoId: p.id, precioGeneral: p.precioGeneral }, especiales);
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{nombreProducto(p)}</td>
                      <td>
                        {formatoPesos(precio)}
                        {especiales.has(p.id) && <span className="text-xs text-amber-700"> especial</span>}
                      </td>
                      <td>
                        <input name={`cantidad_${p.id}`} inputMode="numeric" placeholder="0" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
            <Campo etiqueta="Nota">
              <input name="nota" placeholder="Ej.: pedido por WhatsApp, entregar en la tarde" />
            </Campo>
            <Boton type="submit">Crear pedido</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
