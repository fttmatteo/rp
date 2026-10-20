import Link from "next/link";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Boton, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { diaUTC, formatoPesos, hoyISO } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { PestanasContabilidad } from "@/components/secciones";
import { RANGOS_ANTIGUEDAD, resumenAntiguedad } from "@/modules/cartera";
import { enlaceWhatsApp } from "@/modules/contacto";
import { mensajeRecordatorio } from "@/modules/mensajes";

const dias = (desde: Date, hasta: Date) => Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000));

export default async function CarteraPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const sesion = await requerir("cartera.ver");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const pagina = leerPagina(params.pagina);
  // Solo las columnas que se suman; los datos del cliente se piden después, solo para la página que se muestra.
  const deudas = await db.venta.findMany({
    where: { anulada: false, saldo: { gt: 0 } },
    select: { id: true, clienteId: true, fecha: true, vence: true, saldo: true },
    orderBy: { fecha: "asc" },
  });
  const hoy = diaUTC(hoyISO());
  const total = deudas.reduce((s, d) => s + d.saldo, 0);
  const resumen = resumenAntiguedad(deudas, hoy);

  const porCliente = new Map<number, { saldo: number; masAntigua: Date; vencido: number; vencidaDesde: Date | null }>();
  for (const d of deudas) {
    const fila = porCliente.get(d.clienteId) ?? {
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
  // Sin búsqueda se listan los que deben. Con búsqueda, todos los clientes que coinciden, también los que están al día,
  // para poder abrir su cartera (por ejemplo, a cargar un saldo inicial).
  const buscados = q
    ? await db.cliente.findMany({
        where: {
          consumidorFinal: false,
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { telefono: { contains: q } },
            { zona: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
    : null;
  const filas = buscados
    ? buscados.map((c) => [c.id, porCliente.get(c.id) ?? null] as const)
    : [...porCliente.entries()];
  const ordenados = filas.sort((a, b) => (b[1]?.saldo ?? 0) - (a[1]?.saldo ?? 0));
  const enPagina = paginar(ordenados, pagina);
  const datos = new Map(
    (await db.cliente.findMany({ where: { id: { in: enPagina.map(([id]) => id) } }, select: { id: true, nombre: true, telefono: true } })).map((c) => [c.id, c]),
  );
  const clientes = enPagina.map(([id, f]) => [id, { deuda: f, nombre: datos.get(id)?.nombre ?? "", telefono: datos.get(id)?.telefono ?? null }] as const);

  return (
    <>
      <Titulo>Cartera</Titulo>
      <PestanasContabilidad actual="/cartera" operacion={sesion.operacion} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tarjeta>
          <p className="text-stone-600">Total por cobrar</p>
          <p className="text-lg font-semibold tabular-nums">{formatoPesos(total)}</p>
        </Tarjeta>
        {RANGOS_ANTIGUEDAD.map((r) => (
          <Tarjeta key={r}>
            <p className="text-stone-600">{r} días</p>
            <p className={`text-lg font-semibold tabular-nums ${r === "+60" && resumen[r] > 0 ? "text-red-700" : ""}`}>{formatoPesos(resumen[r])}</p>
          </Tarjeta>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" type="search" defaultValue={q} placeholder="Buscar cliente por nombre, teléfono o zona" aria-label="Buscar cliente" className="max-w-sm" />
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
        {q && (
          <Link href="/cartera" className="inline-flex min-h-11 items-center underline">
            Ver todos los que deben
          </Link>
        )}
      </form>
      {clientes.length === 0 ? (
        <Vacio>{q ? "Ningún cliente coincide con esa búsqueda." : "Ningún cliente debe dinero."}</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              {/* En el celular quedan Cliente y Debe; la antigüedad, lo vencido y el recordatorio bajan debajo del cliente. */}
              <th>Cliente</th>
              <th className="hidden sm:table-cell">Deuda más antigua</th>
              <th className="hidden text-right sm:table-cell">Vencido</th>
              <th className="text-right">Debe</th>
              <th className="hidden sm:table-cell">
                <span className="sr-only">Recordatorio</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(([id, c]) => (
              <tr key={id}>
                <td>
                  <Link href={`/cartera/${id}`} className="underline">
                    {c.nombre}
                  </Link>
                  <span className="block text-stone-600 sm:hidden">
                    {c.deuda ? `Hace ${dias(c.deuda.masAntigua, hoy)} días` : "Al día"}
                    {!!c.deuda?.vencido && (
                      <>
                        {" "}
                        · <span className="font-medium whitespace-nowrap text-red-700">vencido {formatoPesos(c.deuda.vencido)}</span>
                      </>
                    )}
                  </span>
                  {c.deuda && (
                    <span className="block sm:hidden">
                      <Recordatorio c={{ ...c.deuda, nombre: c.nombre, telefono: c.telefono }} hoy={hoy} />
                    </span>
                  )}
                </td>
                <td className="hidden sm:table-cell">{c.deuda ? `hace ${dias(c.deuda.masAntigua, hoy)} días` : "Al día"}</td>
                <td className={`hidden whitespace-nowrap text-right tabular-nums sm:table-cell ${c.deuda?.vencido ? "text-red-700" : "text-stone-500"}`}>
                  {formatoPesos(c.deuda?.vencido ?? 0)}
                </td>
                <td className="whitespace-nowrap text-right font-semibold tabular-nums">{formatoPesos(c.deuda?.saldo ?? 0)}</td>
                <td className="hidden sm:table-cell">{c.deuda && <Recordatorio c={{ ...c.deuda, nombre: c.nombre, telefono: c.telefono }} hoy={hoy} />}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <Paginacion ruta="/cartera" params={{ q }} pagina={pagina} total={ordenados.length} />
    </>
  );
}

function Recordatorio({ c, hoy }: { c: { nombre: string; telefono: string | null; vencido: number; vencidaDesde: Date | null }; hoy: Date }) {
  if (c.vencido <= 0 || !c.vencidaDesde) return null;
  const enlace = enlaceWhatsApp(c.telefono, mensajeRecordatorio({ cliente: c.nombre, vencido: c.vencido, dias: dias(c.vencidaDesde, hoy) }));
  if (!enlace) return null;
  return (
    <a href={enlace} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">
      Recordar por WhatsApp
    </a>
  );
}
