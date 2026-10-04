import Link from "next/link";
import { Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { existencias } from "@/lib/existencias";
import { diaUTC, formatoCantidad, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";

export default async function InicioPage() {
  const sesion = await requerir();
  const op = sesion.operacion;
  const hoy = diaUTC(hoyISO());

  const [pendientesHoy, atrasados, cartera, productos, stock, clasificadoHoy, cajasAbiertas] = await Promise.all([
    puede(op, "pedidos.ver") ? db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: hoy } }) : null,
    puede(op, "pedidos.ver") ? db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: { lt: hoy } } }) : null,
    puede(op, "cartera.ver") ? db.venta.aggregate({ where: { anulada: false, saldo: { gt: 0 } }, _sum: { saldo: true } }) : null,
    puede(op, "inventario.ver") ? db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }) : null,
    puede(op, "inventario.ver") ? existencias() : null,
    puede(op, "clasificacion") ? db.registroClasificacion.count({ where: { fecha: hoy } }) : null,
    puede(op, "caja") ? db.caja.findMany({ where: { estado: "ABIERTA", dia: { lt: hoy } } }) : null,
  ]);

  return (
    <>
      <Titulo>Inicio</Titulo>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pendientesHoy !== null && (
          <Tarjeta titulo="Pedidos para hoy">
            <p className="text-2xl font-semibold">{pendientesHoy}</p>
            {atrasados ? <p className="text-sm text-red-700">{atrasados} atrasados de días anteriores</p> : null}
            <Link href="/pedidos" className="text-sm underline">
              Ver pedidos
            </Link>
          </Tarjeta>
        )}
        {cartera && (
          <Tarjeta titulo="Cartera por cobrar">
            <p className="text-2xl font-semibold">{formatoPesos(cartera._sum.saldo ?? 0)}</p>
            <Link href="/cartera" className="text-sm underline">
              Ver cartera
            </Link>
          </Tarjeta>
        )}
        {cajasAbiertas && (
          <Tarjeta titulo="Caja">
            <p className={`text-2xl font-semibold ${cajasAbiertas.length > 0 ? "text-red-700" : ""}`}>
              {cajasAbiertas.length > 0 ? `${cajasAbiertas.length} días sin cerrar` : "Al día"}
            </p>
            <Link href="/caja" className="text-sm underline">
              Ir a la caja
            </Link>
          </Tarjeta>
        )}
        {clasificadoHoy !== null && (
          <Tarjeta titulo="Clasificación de hoy">
            <p className="text-2xl font-semibold">{clasificadoHoy > 0 ? "Registrada" : "Pendiente"}</p>
            <Link href="/clasificacion" className="text-sm underline">
              Registrar clasificación
            </Link>
          </Tarjeta>
        )}
        {productos && stock && (
          <Tarjeta titulo="Inventario" className="sm:col-span-2 lg:col-span-3">
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {productos.map((p) => (
                <li key={p.id}>
                  <span className="text-stone-600">{p.nombre}</span>
                  <br />
                  <strong>{formatoCantidad(p.tipo, stock.get(p.id) ?? 0)}</strong>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
