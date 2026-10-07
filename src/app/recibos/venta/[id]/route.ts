import { db } from "@/lib/db";
import { formatoConsecutivo, formatoFechaHora, formatoPesos, nombreProducto } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { generarRecibo } from "@/lib/recibo-pdf";
import { respuestaPdf } from "@/lib/respuesta-pdf";
import { requerir } from "@/lib/sesion";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerir();
  const general = puede(sesion.operacion, "pedidos.ver") || puede(sesion.operacion, "clientes.ver");
  // El repartidor solo ve los recibos de los pedidos de su propia ruta (desde Mi ruta).
  if (!general && !puede(sesion.operacion, "ruta.propia")) return new Response("Acceso denegado", { status: 403 });
  const id = Number((await params).id);
  const venta = Number.isInteger(id)
    ? await db.venta.findUnique({
        where: { id },
        include: {
          cliente: true,
          usuario: true,
          pedido: { include: { ruta: true, detalles: { include: { producto: true } } } },
          aplicaciones: { include: { pago: true } },
        },
      })
    : null;
  if (!venta) return new Response("No encontrado", { status: 404 });
  if (!general && venta.pedido?.ruta?.repartidorId !== sesion.usuario.id) return new Response("Acceso denegado", { status: 403 });

  const numero = formatoConsecutivo("RP", venta.consecutivo);
  const lineas =
    venta.pedido?.detalles.map((d) => ({
      descripcion: d.producto.tipo === "CUBETA" ? `Cubeta x30 ${d.producto.nombre}` : nombreProducto(d.producto),
      cantidad: d.cantidad,
      precio: d.precioUnitario,
      valor: d.cantidad * d.precioUnitario,
    })) ?? [{ descripcion: venta.nota ? `Saldo inicial: ${venta.nota}` : "Saldo inicial", valor: venta.total }];
  const pagado = venta.aplicaciones.filter((a) => !a.pago.anulado).reduce((s, a) => s + a.valor, 0);

  const bytes = await generarRecibo({
    titulo: venta.tipo === "SALDO_INICIAL" ? "Saldo inicial" : "Recibo de venta",
    numero,
    fecha: formatoFechaHora(venta.fecha),
    cliente: venta.cliente.nombre,
    clienteDetalle: [venta.cliente.direccion, venta.cliente.telefono].filter(Boolean).join(" · "),
    lineas,
    total: venta.total,
    resumen: [
      ["Pagado", formatoPesos(pagado)],
      ["Pendiente (fiado)", formatoPesos(venta.saldo)],
    ],
    anulado: venta.anulada,
    atendidoPor: venta.usuario.nombre,
  });
  return respuestaPdf(bytes, numero);
}
