import Link from "next/link";
import type { ReactNode } from "react";
import { Subnav, Tarjeta, Titulo } from "@/components/ui";
import { avesPorLote, huevosPorLoteYDia } from "@/lib/aves-db";
import { obtenerCaja, totalesCaja } from "@/lib/caja-db";
import { db } from "@/lib/db";
import { existencias } from "@/lib/existencias";
import { diaUTC, formatoCantidad, formatoHuevos, formatoPesos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { instantes } from "@/lib/reportes";
import { requerir } from "@/lib/sesion";
import { existenciasBajas } from "@/modules/alertas";
import { porcentajePostura } from "@/modules/aves";
import { efectivoEsperado } from "@/modules/caja";

/** "1 cliente", "2 clientes". */
const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const SIN_VERIFICAR = { medio: "TRANSFERENCIA", anulado: false, verificadoEn: null } as const;

function Dato({ titulo, valor, detalle, href, enlace, alerta }: { titulo: string; valor: ReactNode; detalle?: ReactNode; href: string; enlace: string; alerta?: boolean }) {
  return (
    <Tarjeta titulo={titulo}>
      <p className={`text-2xl font-semibold ${alerta ? "text-amber-700" : ""}`}>{valor}</p>
      {detalle && <p className="text-sm text-stone-600">{detalle}</p>}
      <Link href={href} className="text-sm underline">
        {enlace}
      </Link>
    </Tarjeta>
  );
}

export default async function InicioPage() {
  const sesion = await requerir();
  const op = sesion.operacion;
  const hoyIso = hoyISO();
  const hoy = diaUTC(hoyIso);
  const si = <T,>(permiso: Parameters<typeof puede>[1], f: () => Promise<T>) => (puede(op, permiso) ? f() : Promise.resolve(null));

  const [
    miRuta,
    sinRuta,
    pendientesHoy,
    atrasados,
    cartera,
    vencida,
    clientesVencidos,
    productos,
    stock,
    clasificadoHoy,
    cajasAbiertas,
    cajaHoy,
    ventasHoy,
    transferencias,
    rutasSinLiquidar,
    rutasPorAprobar,
    porPagar,
    comprasVencidas,
    porClasificar,
    lotes,
  ] = await Promise.all([
    puede(op, "ruta.propia")
      ? db.ruta.findUnique({
          where: { fecha_repartidorId: { fecha: hoy, repartidorId: sesion.usuario.id } },
          include: { _count: { select: { pedidos: { where: { estado: "PENDIENTE" } } } } },
        })
      : undefined,
    si("rutas", () => db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: hoy, rutaId: null } })),
    si("pedidos.ver", () => db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: hoy } })),
    si("pedidos.ver", () => db.pedido.count({ where: { estado: "PENDIENTE", fechaEntrega: { lt: hoy } } })),
    si("cartera.ver", () => db.venta.aggregate({ where: { anulada: false, saldo: { gt: 0 } }, _sum: { saldo: true } })),
    si("cartera.ver", () => db.venta.aggregate({ where: { anulada: false, saldo: { gt: 0 }, vence: { lt: hoy } }, _sum: { saldo: true } })),
    si("cartera.ver", () => db.venta.findMany({ where: { anulada: false, saldo: { gt: 0 }, vence: { lt: hoy } }, select: { clienteId: true }, distinct: ["clienteId"] })),
    si("inventario.ver", () => db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } })),
    si("inventario.ver", () => existencias()),
    si("clasificacion", () => db.registroClasificacion.count({ where: { fecha: hoy } })),
    si("caja", () => db.caja.findMany({ where: { estado: "ABIERTA", dia: { lt: hoy } } })),
    si("caja", async () => {
      const caja = await obtenerCaja(hoy, db, false);
      return efectivoEsperado(await totalesCaja(hoy, caja.base));
    }),
    si("caja", () => db.venta.aggregate({ where: { tipo: "VENTA", anulada: false, fecha: instantes(hoy, hoy) }, _sum: { total: true }, _count: true })),
    si("caja", async () => (await db.pago.count({ where: SIN_VERIFICAR })) + (await db.movimientoCaja.count({ where: SIN_VERIFICAR }))),
    si("rutas", () => db.ruta.count({ where: { estado: "ABIERTA", fecha: { lt: hoy } } })),
    si("rutas.aprobar", () => db.ruta.count({ where: { estado: "PRECERRADA" } })),
    si("compras", () => db.compra.aggregate({ where: { anulada: false, saldo: { gt: 0 } }, _sum: { saldo: true } })),
    si("compras", () => db.compra.count({ where: { anulada: false, saldo: { gt: 0 }, vence: { lt: hoy } } })),
    si("inventario.ver", () => db.compra.aggregate({ where: { anulada: false, porClasificar: { gt: 0 } }, _sum: { porClasificar: true } })),
    si("aves", () => db.lote.findMany({ where: { activo: true } })),
  ]);

  // Postura de hoy de los lotes activos.
  let postura: { huevos: number; aves: number } | null = null;
  if (lotes && lotes.length > 0) {
    const [aves, huevos] = await Promise.all([avesPorLote(lotes), huevosPorLoteYDia(lotes.map((l) => l.id), hoy, hoy)]);
    postura = { aves: [...aves.values()].reduce((s, n) => s + n, 0), huevos: [...huevos.values()].reduce((s, n) => s + n, 0) };
  }

  const bajas =
    productos && stock
      ? existenciasBajas(productos.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, minimo: p.minimo, existencias: stock.get(p.id) ?? 0 })))
      : [];
  const sinClasificar = porClasificar?._sum.porClasificar ?? 0;

  const alertas: { texto: string; href: string }[] = [];
  for (const p of bajas)
    alertas.push({ texto: `${p.nombre}: quedan ${formatoCantidad(p.tipo, p.existencias, productos?.find((x) => x.id === p.id)?.unidad)} (mínimo ${p.minimo}).`, href: "/inventario" });
  if (clientesVencidos?.length)
    alertas.push({ texto: `${cuenta(clientesVencidos.length, "cliente", "clientes")} con deudas vencidas por ${formatoPesos(vencida?._sum.saldo ?? 0)}.`, href: "/cartera" });
  if (cajasAbiertas?.length) alertas.push({ texto: `${cuenta(cajasAbiertas.length, "día", "días")} de caja sin cerrar.`, href: "/caja" });
  if (transferencias) alertas.push({ texto: `${cuenta(transferencias, "transferencia", "transferencias")} sin verificar en el banco.`, href: "/caja" });
  if (rutasPorAprobar)
    alertas.push({ texto: `${cuenta(rutasPorAprobar, "ruta", "rutas")} con precierre del repartidor por aprobar.`, href: "/rutas" });
  if (rutasSinLiquidar) alertas.push({ texto: `${cuenta(rutasSinLiquidar, "ruta", "rutas")} de días anteriores sin liquidar.`, href: "/rutas" });
  if (comprasVencidas) alertas.push({ texto: `${cuenta(comprasVencidas, "compra a proveedor vencida", "compras a proveedores vencidas")}.`, href: "/proveedores" });
  if (sinClasificar > 0) alertas.push({ texto: `${formatoHuevos(sinClasificar)} de huevo comprado por clasificar.`, href: "/clasificacion" });
  if (atrasados) alertas.push({ texto: `${cuenta(atrasados, "pedido atrasado", "pedidos atrasados")} de días anteriores.`, href: "/pedidos" });

  return (
    <>
      <Titulo>Inicio</Titulo>
      <Subnav
        enlaces={[
          alertas.length > 0 && { id: "revisar", texto: `Para revisar (${alertas.length})` },
          { id: "resumen", texto: "Resumen del día" },
          productos && stock && { id: "inventario", texto: "Inventario" },
        ]}
      />
      {alertas.length > 0 && (
        <div id="revisar" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-1 font-semibold text-amber-900">Para revisar</p>
          <ul className="space-y-1">
            {alertas.map((a) => (
              <li key={a.texto}>
                <Link href={a.href} className="text-amber-900 underline">
                  {a.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div id="resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {miRuta !== undefined && (
          <Dato titulo="Mi ruta de hoy" valor={miRuta ? `${miRuta._count.pedidos} por entregar` : "Sin pedidos"} href="/mi-ruta" enlace={miRuta ? "Ver mi ruta" : "Tomar pedidos"} />
        )}
        {ventasHoy && (
          <Dato
            titulo="Ventas de hoy"
            valor={formatoPesos(ventasHoy._sum.total ?? 0)}
            detalle={cuenta(ventasHoy._count, "entrega", "entregas")}
            href="/reportes"
            enlace="Ver reportes"
          />
        )}
        {pendientesHoy !== null && (
          <Dato titulo="Pedidos para hoy" valor={pendientesHoy} detalle={sinRuta ? `${sinRuta} sin tomar` : undefined} href="/pedidos" enlace="Ver pedidos" />
        )}
        {sinRuta !== null && (
          <Dato titulo="Rutas de hoy" valor={sinRuta > 0 ? `${cuenta(sinRuta, "pedido", "pedidos")} sin tomar` : "Todo tomado"} alerta={sinRuta > 0} href="/rutas" enlace="Ver rutas" />
        )}
        {cartera && (
          <Dato
            titulo="Cartera por cobrar"
            valor={formatoPesos(cartera._sum.saldo ?? 0)}
            detalle={vencida?._sum.saldo ? `${formatoPesos(vencida._sum.saldo)} vencida` : "Nada vencido"}
            href="/cartera"
            enlace="Ver cartera"
          />
        )}
        {porPagar && (
          <Dato titulo="Cuentas por pagar" valor={formatoPesos(porPagar._sum.saldo ?? 0)} href="/proveedores" enlace="Ver proveedores" />
        )}
        {cajaHoy !== null && (
          <Dato
            titulo="Efectivo en caja hoy"
            valor={formatoPesos(cajaHoy)}
            detalle={cajasAbiertas?.length ? `${cuenta(cajasAbiertas.length, "día", "días")} sin cerrar` : undefined}
            alerta={!!cajasAbiertas?.length}
            href="/caja"
            enlace="Ir a la caja"
          />
        )}
        {clasificadoHoy !== null && (
          <Dato titulo="Clasificación de hoy" valor={clasificadoHoy > 0 ? "Registrada" : "Pendiente"} href="/clasificacion" enlace="Registrar clasificación" />
        )}
        {postura && (
          <Dato
            titulo="Producción de hoy"
            valor={postura.huevos > 0 ? `${porcentajePostura(postura.huevos, postura.aves)}% postura` : "Sin registro"}
            detalle={`${formatoHuevos(postura.huevos)} de ${postura.aves.toLocaleString("es-CO")} aves`}
            href="/aves"
            enlace="Ver lotes"
          />
        )}
        {productos && stock && (
          <Tarjeta id="inventario" titulo="Inventario" className="sm:col-span-2 lg:col-span-3">
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {productos.map((p) => (
                <li key={p.id}>
                  <span className="text-stone-600">{p.nombre}</span>
                  <br />
                  <strong className={bajas.some((b) => b.id === p.id) ? "text-red-700" : ""}>{formatoCantidad(p.tipo, stock.get(p.id) ?? 0, p.unidad)}</strong>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
