import { FiltrosHistorial, HistorialDinero, diasDelMes, mesElegido, type Opcion } from "@/components/historial-dinero";
import { db } from "@/lib/db";
import { nombreMes } from "@/modules/libro";
import { filaIngreso, filaPago, incluirPago, origenPago } from "./filas";

const TIPOS: Opcion[] = [
  { valor: "", texto: "Todo lo que entró" },
  { valor: "ventas", texto: "Ventas en el punto" },
  { valor: "ruta", texto: "Cobros en ruta" },
  { valor: "abonos", texto: "Abonos de clientes" },
  { valor: "otros", texto: "Otros ingresos" },
  { valor: "sobrantes", texto: "Sobrantes de ruta" },
];

/** Todo lo que entró en un mes: ventas en el punto, cobros en ruta, abonos, otros ingresos y sobrantes de ruta. */
export async function HistorialIngresos({
  diaISO,
  mes: mesParam,
  tipo: tipoParam,
  pagina,
}: {
  diaISO: string;
  mes?: string;
  tipo?: string;
  pagina: number;
}) {
  const mes = mesElegido(mesParam, diaISO);
  const tipo = TIPOS.find((t) => t.valor === tipoParam)?.valor ?? "";
  const dia = diasDelMes(mes);
  const conPagos = tipo === "" || tipo === "ventas" || tipo === "ruta" || tipo === "abonos";
  const conMovimientos = tipo === "" || tipo === "otros" || tipo === "sobrantes";
  const [pagos, movimientos] = await Promise.all([
    conPagos
      ? db.pago.findMany({
          where: { dia, ...(tipo === "ruta" ? { rutaId: { not: null } } : tipo === "ventas" || tipo === "abonos" ? { rutaId: null } : {}) },
          include: incluirPago,
        })
      : [],
    conMovimientos
      ? db.movimientoCaja.findMany({
          where: { dia, tipo: "INGRESO", ...(tipo === "otros" ? { rutaId: null } : tipo === "sobrantes" ? { rutaId: { not: null } } : {}) },
          include: { usuario: { select: { nombre: true } } },
        })
      : [],
  ]);
  // Venta o abono depende de a qué recibos se aplicó el pago, así que se separan aquí.
  const elegidos = tipo === "ventas" ? pagos.filter((p) => origenPago(p) === "Venta") : tipo === "abonos" ? pagos.filter((p) => origenPago(p) === "Abono") : pagos;
  const filas = [...elegidos.map(filaPago), ...movimientos.map((m) => filaIngreso(m))].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <>
      <FiltrosHistorial ruta="/ingresos" diaISO={diaISO} mes={mes} tipo={tipo} tipos={TIPOS} />
      <HistorialDinero
        titulo={`${TIPOS.find((t) => t.valor === tipo)!.texto} · ${nombreMes(mes)}`}
        filas={filas}
        vacio="No entró plata de este tipo en este mes."
        ruta="/ingresos"
        params={{ dia: diaISO, registrar: "historial", mes, tipo: tipo || undefined }}
        pagina={pagina}
      />
    </>
  );
}
