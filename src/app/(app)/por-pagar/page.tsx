import Link from "next/link";
import { PestanasContabilidad } from "@/components/secciones";
import { Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoFecha, formatoPesos, hoyISO } from "@/lib/formato";
import { requerir } from "@/lib/sesion";

/** Cuentas por pagar: lo que le debemos a cada proveedor por compras a crédito. */
export default async function PorPagarPage() {
  const sesion = await requerir("compras");
  const [deudas, proveedores] = await Promise.all([
    db.compra.findMany({
      where: { anulada: false, saldo: { gt: 0 } },
      select: { proveedorId: true, fecha: true, vence: true, saldo: true },
      orderBy: { fecha: "asc" },
    }),
    db.proveedor.findMany({ select: { id: true, nombre: true, activo: true } }),
  ]);
  const hoy = diaUTC(hoyISO());
  const porProveedor = new Map<number, { saldo: number; vencido: number; compras: number; masAntigua: Date }>();
  for (const d of deudas) {
    const fila = porProveedor.get(d.proveedorId) ?? { saldo: 0, vencido: 0, compras: 0, masAntigua: d.fecha };
    fila.saldo += d.saldo;
    fila.compras += 1;
    if (d.vence && d.vence < hoy) fila.vencido += d.saldo;
    porProveedor.set(d.proveedorId, fila);
  }
  const total = deudas.reduce((s, d) => s + d.saldo, 0);
  const vencido = [...porProveedor.values()].reduce((s, f) => s + f.vencido, 0);
  // Primero a quienes les debemos; los que están al día quedan abajo para ver su historial de abonos.
  const filas = proveedores
    .map((p) => ({ ...p, deuda: porProveedor.get(p.id) }))
    .filter((p) => p.activo || p.deuda)
    .sort((a, b) => (b.deuda?.saldo ?? 0) - (a.deuda?.saldo ?? 0) || a.nombre.localeCompare(b.nombre));

  return (
    <>
      <Titulo>Por pagar</Titulo>
      <PestanasContabilidad actual="/por-pagar" operacion={sesion.operacion} />
      <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
        <Tarjeta>
          <p className="text-sm text-stone-600">Total por pagar</p>
          <p className="text-lg font-semibold">{formatoPesos(total)}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-stone-600">Vencido</p>
          <p className={`text-lg font-semibold ${vencido > 0 ? "text-red-700" : ""}`}>{formatoPesos(vencido)}</p>
        </Tarjeta>
      </div>
      {filas.length === 0 ? (
        <Vacio>Todavía no hay proveedores.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Compras por pagar</th>
              <th>Más antigua</th>
              <th className="text-right">Vencido</th>
              <th className="text-right">Le debemos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/por-pagar/${p.id}`} className="underline">
                    {p.nombre}
                  </Link>{" "}
                  {!p.activo && <Etiqueta>Inactivo</Etiqueta>}
                </td>
                <td>{p.deuda?.compras ?? 0}</td>
                <td>{p.deuda ? formatoFecha(p.deuda.masAntigua) : "Al día"}</td>
                <td className={`text-right ${p.deuda?.vencido ? "text-red-700" : "text-stone-500"}`}>{formatoPesos(p.deuda?.vencido ?? 0)}</td>
                <td className="text-right font-semibold">{formatoPesos(p.deuda?.saldo ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <p className="mt-2 text-sm text-stone-500">Las compras y los pagos a proveedores se registran en Egresos. Para pagar una compra en particular, abre el proveedor.</p>
    </>
  );
}
