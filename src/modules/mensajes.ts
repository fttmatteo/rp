// Textos para enviar por WhatsApp con enlaces wa.me. El usuario los revisa y pulsa Enviar.

const pesos = (v: number) => "$ " + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

export interface LineaMensaje {
  cantidad: number;
  producto: string;
}

const lineas = (l: LineaMensaje[]) => l.map((x) => `• ${x.cantidad} ${x.producto}`).join("\n");

export function mensajePedido(d: { cliente: string; fecha: string; lineas: LineaMensaje[]; total: number }): string {
  return `Hola ${d.cliente}, confirmamos su pedido para el ${d.fecha}:\n${lineas(d.lineas)}\nTotal: ${pesos(d.total)}\nGracias por su compra.`;
}

export function mensajeRecibo(d: { cliente: string; numero: string; total: number; pagado: number; saldoTotal: number }): string {
  const pendiente = d.total - d.pagado;
  return [
    `Hola ${d.cliente}, este es su recibo ${d.numero}.`,
    `Total: ${pesos(d.total)}`,
    `Pagado: ${pesos(d.pagado)}`,
    pendiente > 0 ? `Queda pendiente: ${pesos(pendiente)}` : null,
    d.saldoTotal > 0 ? `Saldo total de su cuenta: ${pesos(d.saldoTotal)}` : null,
    "Gracias por su compra.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface DeudaMensaje {
  numero: string;
  fecha: string;
  saldo: number;
  vencida: boolean;
}

export function mensajeEstadoCuenta(d: { cliente: string; deudas: DeudaMensaje[] }): string {
  const total = d.deudas.reduce((s, x) => s + x.saldo, 0);
  if (total === 0) return `Hola ${d.cliente}, su cuenta está al día. ¡Gracias!`;
  const detalle = d.deudas.map((x) => `• ${x.numero} del ${x.fecha}: ${pesos(x.saldo)}${x.vencida ? " (vencida)" : ""}`).join("\n");
  return `Hola ${d.cliente}, este es su estado de cuenta:\n${detalle}\nTotal pendiente: ${pesos(total)}`;
}

export function mensajeRecordatorio(d: { cliente: string; vencido: number; dias: number }): string {
  return `Hola ${d.cliente}, le recordamos que tiene un saldo vencido de ${pesos(d.vencido)} desde hace ${d.dias} días. Quedamos atentos a su pago. ¡Gracias!`;
}

export function mensajeEnCamino(cliente: string): string {
  return `Hola ${cliente}, su pedido de huevos va en camino. ¡Gracias!`;
}
