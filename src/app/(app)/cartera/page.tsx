import Link from "next/link";
import { Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoPesos, hoyISO } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { RANGOS_ANTIGUEDAD, resumenAntiguedad } from "@/modules/cartera";

export default async function CarteraPage() {
  await requerir("cartera.ver");
  const deudas = await db.venta.findMany({
    where: { anulada: false, saldo: { gt: 0 } },
    include: { cliente: true },
    orderBy: { fecha: "asc" },
  });
  const hoy = diaUTC(hoyISO());
  const total = deudas.reduce((s, d) => s + d.saldo, 0);
  const resumen = resumenAntiguedad(deudas, hoy);

  const porCliente = new Map<number, { nombre: string; saldo: number; masAntigua: Date; vencido: number }>();
  for (const d of deudas) {
    const fila = porCliente.get(d.clienteId) ?? { nombre: d.cliente.nombre, saldo: 0, masAntigua: d.fecha, vencido: 0 };
    fila.saldo += d.saldo;
    if (d.vence < hoy) fila.vencido += d.saldo;
    porCliente.set(d.clienteId, fila);
  }
  const clientes = [...porCliente.entries()].sort((a, b) => b[1].saldo - a[1].saldo);

  return (
    <>
      <Titulo>Cartera</Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tarjeta>
          <p className="text-sm text-stone-600">Total por cobrar</p>
          <p className="text-lg font-semibold">{formatoPesos(total)}</p>
        </Tarjeta>
        {RANGOS_ANTIGUEDAD.map((r) => (
          <Tarjeta key={r}>
            <p className="text-sm text-stone-600">{r} días</p>
            <p className={`text-lg font-semibold ${r === "+60" && resumen[r] > 0 ? "text-red-700" : ""}`}>{formatoPesos(resumen[r])}</p>
          </Tarjeta>
        ))}
      </div>
      {clientes.length === 0 ? (
        <Vacio>Ningún cliente debe dinero.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Deuda más antigua</th>
              <th className="text-right">Vencido</th>
              <th className="text-right">Debe</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(([id, c]) => (
              <tr key={id}>
                <td>
                  <Link href={`/clientes/${id}`} className="underline">
                    {c.nombre}
                  </Link>
                </td>
                <td>hace {Math.max(0, Math.floor((hoy.getTime() - c.masAntigua.getTime()) / 86_400_000))} días</td>
                <td className={`text-right ${c.vencido > 0 ? "text-red-700" : "text-stone-500"}`}>{formatoPesos(c.vencido)}</td>
                <td className="text-right font-semibold">{formatoPesos(c.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </>
  );
}
