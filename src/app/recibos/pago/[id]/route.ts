import { db } from "@/lib/db";
import { formatoConsecutivo, formatoFechaHora, formatoPesos } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { generarRecibo } from "@/lib/recibo-pdf";
import { respuestaPdf } from "@/lib/respuesta-pdf";
import { requerir } from "@/lib/sesion";
import { saldoCliente } from "@/lib/cartera-db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerir();
  if (!puede(sesion.operacion, "clientes.ver")) return new Response("Acceso denegado", { status: 403 });
  const id = Number((await params).id);
  const pago = Number.isInteger(id)
    ? await db.pago.findUnique({
        where: { id },
        include: { cliente: true, usuario: true, aplicaciones: { include: { venta: true } } },
      })
    : null;
  if (!pago) return new Response("No encontrado", { status: 404 });

  const numero = formatoConsecutivo("AB", pago.consecutivo);
  const bytes = await generarRecibo({
    titulo: "Recibo de pago",
    numero,
    fecha: formatoFechaHora(pago.fecha),
    cliente: pago.cliente.nombre,
    clienteDetalle: [pago.cliente.direccion, pago.cliente.telefono].filter(Boolean).join(" · "),
    lineas: pago.aplicaciones.map((a) => ({
      descripcion: `Abono a ${formatoConsecutivo("RP", a.venta.consecutivo)}`,
      valor: a.valor,
    })),
    total: pago.valor,
    resumen: [
      ["Medio", pago.medio === "EFECTIVO" ? "Efectivo" : `Transferencia${pago.referencia ? ` (${pago.referencia})` : ""}`],
      // Los pagos anteriores a guardar el saldo muestran el de hoy.
      pago.saldoDespues === null
        ? ["Saldo actual del cliente", formatoPesos(await saldoCliente(pago.clienteId))]
        : ["Saldo después de este pago", formatoPesos(pago.saldoDespues)],
    ],
    anulado: pago.anulado,
    atendidoPor: pago.usuario.nombre,
  });
  return respuestaPdf(bytes, numero);
}
