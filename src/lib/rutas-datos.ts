import "server-only";
import { db } from "@/lib/db";
import { cierreReparto, valoresPedido, type PedidoReparto } from "@/modules/reparto";
import { liquidarRuta } from "@/modules/rutas";

/** Todo lo que se muestra de una ruta: paradas en orden, cierre por clasificación y liquidación. */
export async function datosRuta(rutaId: number) {
  const ruta = await db.ruta.findUnique({ where: { id: rutaId }, include: { repartidor: true, liquidadaPor: true } });
  if (!ruta) return null;
  const [pedidos, pagos] = await Promise.all([
    db.pedido.findMany({
      where: { rutaId, estado: { not: "CANCELADO" } },
      orderBy: [{ ordenEnRuta: "asc" }, { id: "asc" }],
      include: {
        cliente: true,
        detalles: { include: { producto: true }, orderBy: { id: "asc" } },
        venta: { include: { aplicaciones: { include: { pago: true } } } },
      },
    }),
    db.pago.findMany({ where: { rutaId, anulado: false }, orderBy: { fecha: "asc" }, include: { cliente: true } }),
  ]);
  const filas = pedidos.map((p) => {
    const venta = p.venta && !p.venta.anulada ? p.venta : null;
    const reparto: PedidoReparto = {
      entregado: p.estado === "ENTREGADO" && venta !== null,
      noEntregado: p.estado === "NO_ENTREGADO",
      detalles: p.detalles,
      // En la ruta, lo pagado en la entrega es lo cobrado por el repartidor en esa ruta.
      pagos: venta
        ? venta.aplicaciones
            .filter((a) => !a.pago.anulado && a.pago.rutaId === rutaId)
            .map((a) => ({ valor: a.valor, medio: a.pago.medio }))
        : [],
    };
    return { pedido: p, reparto, valores: valoresPedido(reparto) };
  });
  const cierre = cierreReparto(filas.map((f) => f.reparto));
  const liquidacion = liquidarRuta(pagos, { efectivo: cierre.pagadoEfectivo, transferencia: cierre.pagadoTransferencia });
  return { ruta, filas, cierre, liquidacion, pagos };
}
