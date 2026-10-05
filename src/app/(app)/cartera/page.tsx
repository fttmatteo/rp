import Link from "next/link";
import { Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoPesos, hoyISO } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { RANGOS_ANTIGUEDAD, resumenAntiguedad } from "@/modules/cartera";
import { enlaceWhatsApp } from "@/modules/contacto";
import { mensajeRecordatorio } from "@/modules/mensajes";

const dias = (desde: Date, hasta: Date) => Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000));

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

  const porCliente = new Map<
    number,
    { nombre: string; telefono: string | null; saldo: number; masAntigua: Date; vencido: number; vencidaDesde: Date | null }
  >();
  for (const d of deudas) {
    const fila = porCliente.get(d.clienteId) ?? {
      nombre: d.cliente.nombre,
      telefono: d.cliente.telefono,
      saldo: 0,
      masAntigua: d.fecha,
      vencido: 0,
      vencidaDesde: null,
    };
    fila.saldo += d.saldo;
    if (d.vence < hoy) {
      fila.vencido += d.saldo;
      if (!fila.vencidaDesde || d.vence < fila.vencidaDesde) fila.vencidaDesde = d.vence;
    }
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
              <th></th>
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
                <td>hace {dias(c.masAntigua, hoy)} días</td>
                <td className={`text-right ${c.vencido > 0 ? "text-red-700" : "text-stone-500"}`}>{formatoPesos(c.vencido)}</td>
                <td className="text-right font-semibold">{formatoPesos(c.saldo)}</td>
                <td>
                  <Recordatorio c={c} hoy={hoy} />
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </>
  );
}

function Recordatorio({ c, hoy }: { c: { nombre: string; telefono: string | null; vencido: number; vencidaDesde: Date | null }; hoy: Date }) {
  if (c.vencido <= 0 || !c.vencidaDesde) return null;
  const enlace = enlaceWhatsApp(c.telefono, mensajeRecordatorio({ cliente: c.nombre, vencido: c.vencido, dias: dias(c.vencidaDesde, hoy) }));
  if (!enlace) return null;
  return (
    <a href={enlace} target="_blank" rel="noreferrer" className="text-sm underline">
      Recordar por WhatsApp
    </a>
  );
}
