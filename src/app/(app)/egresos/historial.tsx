import { FiltrosHistorial, HistorialDinero, diasDelMes, mesElegido, type Opcion } from "@/components/historial-dinero";
import { db } from "@/lib/db";
import { puede, type Operacion } from "@/lib/permisos";
import { CONCEPTOS_GASTO, OTRO_GASTO } from "@/modules/gastos";
import { nombreMes } from "@/modules/libro";
import { filaEgreso, incluirEgreso, whereTipoEgreso } from "./filas";
import { HistorialCompras } from "./historial-compras";

/**
 * Todo lo que salió en un mes: compras, pagos a proveedores, gastos y faltantes de ruta.
 * Con el tipo Compras se ve el detalle de cada compra de huevo, también las de crédito (que no sacan plata de la caja).
 */
export async function HistorialEgresos({
  operacion,
  diaISO,
  mes: mesParam,
  tipo: tipoParam,
  concepto: conceptoParam,
  pagina,
}: {
  operacion: Operacion;
  diaISO: string;
  mes?: string;
  tipo?: string;
  concepto?: string;
  pagina: number;
}) {
  const verCompras = puede(operacion, "compras");
  const tipos: Opcion[] = [
    { valor: "", texto: "Todo lo que salió" },
    ...(verCompras ? [{ valor: "compras", texto: "Compras de huevo" }] : []),
    { valor: "pagos", texto: "Pagos a proveedores" },
    { valor: "gastos", texto: "Gastos y retiros" },
    { valor: "faltantes", texto: "Faltantes de ruta" },
  ];
  const mes = mesElegido(mesParam, diaISO);
  const tipo = tipos.find((t) => t.valor === tipoParam)?.valor ?? "";
  const conceptos = [...CONCEPTOS_GASTO, OTRO_GASTO] as string[];
  const concepto = tipo === "gastos" && conceptoParam && conceptos.includes(conceptoParam) ? conceptoParam : "";
  const params = { dia: diaISO, registrar: "historial", mes, tipo: tipo || undefined, concepto: concepto || undefined };

  const filtros = (
    <FiltrosHistorial
      ruta="/egresos"
      diaISO={diaISO}
      mes={mes}
      tipo={tipo}
      tipos={tipos}
      extra={
        tipo === "gastos"
          ? {
              nombre: "concepto",
              etiqueta: "Gasto",
              valor: concepto,
              opciones: [{ valor: "", texto: "Todos" }, ...CONCEPTOS_GASTO.map((c) => ({ valor: c, texto: c })), { valor: OTRO_GASTO, texto: "Otros" }],
            }
          : undefined
      }
    />
  );

  if (tipo === "compras") {
    return (
      <>
        {filtros}
        <HistorialCompras operacion={operacion} pagina={pagina} mes={mes} params={params} />
      </>
    );
  }

  const movimientos = await db.movimientoCaja.findMany({
    where: {
      tipo: "EGRESO",
      dia: diasDelMes(mes),
      ...whereTipoEgreso(tipo),
      // "Otros": gastos escritos a mano, que no están en la lista.
      ...(concepto === OTRO_GASTO ? { concepto: { notIn: [...CONCEPTOS_GASTO] } } : concepto ? { concepto } : {}),
    },
    orderBy: { fecha: "desc" },
    include: incluirEgreso,
  });
  const titulo = tipos.find((t) => t.valor === tipo)!.texto;
  return (
    <>
      {filtros}
      <HistorialDinero
        titulo={`${concepto ? (concepto === OTRO_GASTO ? "Otros gastos" : concepto) : titulo} · ${nombreMes(mes)}`}
        filas={movimientos.map((m) => filaEgreso(m))}
        vacio="No salió plata de este tipo en este mes."
        ruta="/egresos"
        params={params}
        pagina={pagina}
        nota={tipo === "" && verCompras ? "Las compras a crédito no salen de la caja: se ven en Compras de huevo y se pagan en Pagos a proveedores." : undefined}
      />
    </>
  );
}
