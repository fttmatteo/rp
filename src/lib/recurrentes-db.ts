import "server-only";
import { auditar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { diaUTC, hoyISO } from "@/lib/formato";
import { precioParaCliente, totalPedido } from "@/modules/precios";
import { diaDeLaSemana } from "@/modules/recurrentes";

/**
 * Carga a Pedidos, como "por aprobar", los pedidos recurrentes que tocan ese día y aún no se han generado.
 * No hay tareas programadas en el servidor: se llama al abrir el inicio y la lista de pedidos, y es seguro
 * llamarlo varias veces o desde dos pantallas a la vez (un recurrente tiene a lo sumo un pedido por día).
 */
export async function generarPedidosRecurrentes(dia: Date = diaUTC(hoyISO())): Promise<number> {
  const recurrentes = await db.pedidoRecurrente.findMany({
    where: {
      activo: true,
      desde: { lte: dia },
      diasSemana: { has: diaDeLaSemana(dia) },
      cliente: { activo: true },
      pedidos: { none: { fechaEntrega: dia } },
    },
    include: { detalles: true, cliente: { include: { precios: true } } },
    orderBy: { id: "asc" },
  });
  if (recurrentes.length === 0) return 0;

  const productos = new Map((await db.producto.findMany({ where: { activo: true } })).map((p) => [p.id, p]));
  let creados = 0;
  for (const r of recurrentes) {
    const especiales = new Map(r.cliente.precios.map((p) => [p.productoId, p.precio]));
    // El precio es el del cliente el día en que se genera, y queda congelado como en cualquier pedido.
    const detalles = r.detalles.flatMap((d) => {
      const p = productos.get(d.productoId);
      return p ? [{ productoId: p.id, cantidad: d.cantidad, precioUnitario: precioParaCliente({ productoId: p.id, precioGeneral: p.precioGeneral }, especiales) }] : [];
    });
    if (detalles.length === 0) continue;
    try {
      await db.$transaction(async (tx) => {
        const pedido = await tx.pedido.create({
          data: {
            clienteId: r.clienteId,
            fechaEntrega: dia,
            estado: "POR_APROBAR",
            nota: r.nota,
            creadoPorId: r.creadoPorId,
            recurrenteId: r.id,
            detalles: { create: detalles },
          },
        });
        await auditar(tx, r.creadoPorId, "Pedido", pedido.id, "generar_recurrente", { recurrenteId: r.id, detalles, total: totalPedido(detalles) });
      });
      creados++;
    } catch (e) {
      // Otra pantalla lo generó al mismo tiempo: la restricción única lo impidió aquí.
      if ((e as { code?: unknown }).code !== "P2002") throw e;
    }
  }
  return creados;
}
