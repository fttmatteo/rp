import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Boton, BotonLink, Campo, Etiqueta, Subnav, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { huevosPorLoteYDia, novedadesDe } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { ESTADO_LOTE, TIPO_NOVEDAD } from "@/lib/etiquetas-aves";
import { diaUTC, formatoDia, hoyISO, sumarDias } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { avesVivas, bajasPorTipo, edadSemanas, porcentajePostura } from "@/modules/aves";
import { actualizarLote, anularNovedad, registrarNovedad } from "../acciones";

const DIAS = 30;

export default async function LotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const sesion = await requerir("aves");
  const pagina = leerPagina((await searchParams).pagina);
  const id = Number((await params).id);
  const lote = Number.isInteger(id) ? await db.lote.findUnique({ where: { id }, include: { galpon: true } }) : null;
  if (!lote) notFound();
  const hoy = diaUTC(hoyISO());
  const desde = sumarDias(hoy, -(DIAS - 1));
  const [novedades, otros, huevos] = await Promise.all([
    novedadesDe([id]),
    db.lote.findMany({ where: { activo: true, id: { not: id } }, include: { galpon: true }, orderBy: { nombre: "asc" } }),
    huevosPorLoteYDia([id], desde, hoy),
  ]);
  const vivas = avesVivas(lote, novedades);
  const bajas = bajasPorTipo(novedades.filter((n) => n.loteId === id));
  const mortalidad = lote.cantidadInicial > 0 ? Math.round((bajas.MUERTE / lote.cantidadInicial) * 1000) / 10 : 0;

  const produccion = Array.from({ length: DIAS }, (_, i) => {
    const dia = sumarDias(hoy, -i);
    const iso = dia.toISOString().slice(0, 10);
    const total = huevos.get(`${id}|${iso}`);
    const aves = avesVivas(lote, novedades, dia);
    return { dia, total, aves, postura: total === undefined ? null : porcentajePostura(total, aves) };
  }).filter((p) => p.total !== undefined);
  // Todas las novedades cuentan para las aves vivas; en pantalla van por páginas.
  const ordenadas = [...novedades].sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id);
  const lista = paginar(ordenadas, pagina);
  // Solo los nombres de los lotes y usuarios que aparecen en esta página.
  const [lotesVistos, usuariosVistos] = await Promise.all([
    db.lote.findMany({ where: { id: { in: [...new Set(lista.flatMap((n) => [n.loteId, n.loteDestinoId ?? n.loteId]))] } }, select: { id: true, nombre: true } }),
    db.usuario.findMany({ where: { id: { in: [...new Set(lista.map((n) => n.usuarioId))] } }, select: { id: true, nombre: true } }),
  ]);
  const nombresLote = new Map(lotesVistos.map((l) => [l.id, l.nombre]));
  const nombreUsuario = new Map(usuariosVistos.map((u) => [u.id, u.nombre]));

  return (
    <>
      <Titulo
        accion={
          <BotonLink href="/aves" variante="secundario">
            Volver
          </BotonLink>
        }
      >
        {lote.nombre} · {lote.galpon.nombre} {!lote.activo && <Etiqueta>Cerrado</Etiqueta>}
      </Titulo>
      <Subnav
        enlaces={[
          lote.activo && { id: "novedad", texto: "Registrar novedad" },
          { id: "produccion", texto: "Producción" },
          { id: "novedades", texto: "Novedades" },
          { id: "estado", texto: "Estado del lote" },
        ]}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta>
          <p className="text-sm text-stone-600">Aves vivas</p>
          <p className="text-2xl font-semibold">{vivas.toLocaleString("es-CO")}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-stone-600">Edad</p>
          <p className="text-2xl font-semibold">{edadSemanas(lote.fechaIngreso, lote.edadIngresoSemanas, hoy)} sem.</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-stone-600">Estado</p>
          <p className="text-2xl font-semibold">{ESTADO_LOTE[lote.estado]}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-stone-600">Mortalidad acumulada</p>
          <p className="text-2xl font-semibold">{mortalidad}%</p>
          <p className="text-xs text-stone-500">
            {bajas.MUERTE} muertes · {bajas.DESCARTE} descartes · {bajas.VENTA} a venta
          </p>
        </Tarjeta>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {lote.activo && (
          <Tarjeta id="novedad" titulo="Registrar novedad">
            <Formulario accion={registrarNovedad.bind(null, id)}>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Tipo">
                  <select name="tipo" defaultValue="MUERTE">
                    {Object.entries(TIPO_NOVEDAD).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Cantidad de aves">
                  <input name="cantidad" inputMode="numeric" required />
                </Campo>
                <Campo etiqueta="Fecha">
                  <input name="fecha" type="date" defaultValue={hoyISO()} max={hoyISO()} required />
                </Campo>
                <Campo etiqueta="Lote de destino" ayuda="Solo para traslados.">
                  <select name="loteDestinoId" defaultValue="">
                    <option value="">—</option>
                    {otros.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre} ({l.galpon.nombre})
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <Campo etiqueta="Nota">
                <input name="nota" />
              </Campo>
              <p className="text-xs text-stone-500">
                Paso a venta: las gallinas salen del lote y suman al inventario para venderlas en los pedidos.
              </p>
              <Boton type="submit">Registrar</Boton>
            </Formulario>
          </Tarjeta>
        )}

        <Tarjeta id="produccion" titulo={`Producción de los últimos ${DIAS} días`}>
          {produccion.length === 0 ? (
            <p className="text-sm text-stone-500">
              Sin registros. En{" "}
              <Link href="/clasificacion" className="underline">
                Clasificación
              </Link>{" "}
              elige este lote al registrar los huevos del día.
            </p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Día</th>
                  <th className="text-right">Huevos</th>
                  <th className="text-right">Aves</th>
                  <th className="text-right">Postura</th>
                </tr>
              </thead>
              <tbody>
                {produccion.map((p) => (
                  <tr key={p.dia.getTime()}>
                    <td>{formatoDia(p.dia)}</td>
                    <td className="text-right">{p.total?.toLocaleString("es-CO")}</td>
                    <td className="text-right">{p.aves.toLocaleString("es-CO")}</td>
                    <td className="text-right">{p.postura === null ? "—" : `${p.postura}%`}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>

        <Tarjeta id="novedades" titulo="Novedades">
          <p className="mb-2 text-sm text-stone-600">
            Ingresaron {lote.cantidadInicial.toLocaleString("es-CO")} aves el {formatoDia(lote.fechaIngreso)}
            {lote.raza && ` · ${lote.raza}`}.
          </p>
          <ul className="divide-y divide-stone-100 text-sm">
            {lista.map((n) => {
              const entrada = n.loteDestinoId === id;
              return (
                <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {formatoDia(n.fecha)} · {entrada ? `Traslado desde ${nombresLote.get(n.loteId)}` : TIPO_NOVEDAD[n.tipo]}
                    {!entrada && n.loteDestinoId && ` a ${nombresLote.get(n.loteDestinoId)}`}
                    {n.nota && <span className="text-stone-500"> · {n.nota}</span>}
                    <span className="text-stone-400"> · {nombreUsuario.get(n.usuarioId)}</span>{" "}
                    {n.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={n.anulada ? "text-stone-400 line-through" : entrada ? "text-green-700" : "text-red-700"}>
                      {entrada ? "+" : "−"}
                      {n.cantidad}
                    </span>
                    {!n.anulada && !entrada && puede(sesion.operacion, "anular") && (
                      <Formulario accion={anularNovedad.bind(null, n.id)} confirmar="¿Anular esta novedad?" className="inline">
                        <button type="submit" className="text-xs text-red-700 underline">
                          Anular
                        </button>
                      </Formulario>
                    )}
                  </span>
                </li>
              );
            })}
            {lista.length === 0 && <li className="py-2 text-stone-500">Sin novedades.</li>}
          </ul>
          <Paginacion ruta={`/aves/${id}`} pagina={pagina} total={ordenadas.length} ancla="novedades" />
        </Tarjeta>

        <Tarjeta id="estado" titulo="Estado del lote">
          <Formulario accion={actualizarLote.bind(null, id)}>
            <Campo etiqueta="Estado">
              <select name="estado" defaultValue={lote.estado}>
                {Object.entries(ESTADO_LOTE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Nota">
              <input name="nota" defaultValue={lote.nota ?? ""} />
            </Campo>
            <label className="flex items-center gap-2 font-normal">
              <input type="checkbox" name="cerrado" defaultChecked={!lote.activo} /> Lote cerrado (ya no tiene aves)
            </label>
            <Boton type="submit" variante="secundario">
              Guardar
            </Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
