import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Boton, BotonLink, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio, Vistas, vistaElegida } from "@/components/ui";
import { huevosPorLoteYDia, novedadesDe } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { ESTADO_LOTE, TIPO_NOVEDAD } from "@/lib/etiquetas-aves";
import { diaUTC, formatoDia, hoyISO, sumarDias } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { avesQueEntraron, avesVivas, bajasPorTipo, edadSemanas, porcentajePostura } from "@/modules/aves";
import { actualizarGalpon, anularNovedad, entradaAves, registrarNovedad } from "../acciones";
import { CamposEntrada } from "../campos-entrada";

const DIAS = 30;

export default async function GalponPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string; ver?: string }>;
}) {
  const sesion = await requerir("aves");
  const sp = await searchParams;
  const pagina = leerPagina(sp.pagina);
  const id = Number((await params).id);
  const galpon = Number.isInteger(id)
    ? await db.galpon.findUnique({ where: { id }, include: { lotes: { orderBy: [{ fechaIngreso: "desc" }, { id: "desc" }] } } })
    : null;
  if (!galpon) notFound();
  // Las aves de hoy son el lote activo; los cerrados son aves que ya salieron del galpón.
  const lote = galpon.lotes.find((l) => l.activo) ?? null;
  const anteriores = galpon.lotes.filter((l) => !l.activo);
  // Las novedades que se ven (y se pueden anular) son las de las aves de hoy o, si está vacío, las de las últimas que salieron.
  const ultimo = lote ?? anteriores[0] ?? null;
  const hoy = diaUTC(hoyISO());
  const desde = sumarDias(hoy, -(DIAS - 1));
  const [novedades, otros, huevos] = await Promise.all([
    novedadesDe(galpon.lotes.map((l) => l.id)),
    lote ? db.galpon.findMany({ where: { activo: true, id: { not: id } }, orderBy: { nombre: "asc" } }) : [],
    lote ? huevosPorLoteYDia([lote.id], desde, hoy) : new Map<string, number>(),
  ]);
  const deLote = (loteId: number) => novedades.filter((n) => n.loteId === loteId || n.loteDestinoId === loteId);

  // Una parte a la vez; con aves se abre en la novedad, que es lo que más se registra.
  const vistas = [
    lote && { clave: "novedad", texto: "Registrar novedad" },
    !lote && galpon.activo && { clave: "entrada", texto: "Entrada de aves" },
    lote && { clave: "produccion", texto: "Producción" },
    ultimo && { clave: "novedades", texto: "Novedades" },
    anteriores.length > 0 && { clave: "anteriores", texto: "Aves anteriores" },
    { clave: "datos", texto: "Datos del galpón" },
  ];
  const ver = vistaElegida(sp.ver, vistas);

  return (
    <>
      <Titulo
        accion={
          <BotonLink href="/aves" variante="secundario">
            Volver
          </BotonLink>
        }
      >
        {galpon.nombre} {!lote && <Etiqueta>{galpon.activo ? "Vacío" : "Fuera de uso"}</Etiqueta>}
      </Titulo>
      {lote ? <Resumen lote={lote} novedades={deLote(lote.id)} hoy={hoy} capacidad={galpon.capacidad} /> : <p className="mb-4 text-stone-600">Este galpón no tiene aves.</p>}

      <Vistas ruta={`/aves/${id}`} actual={ver ?? ""} vistas={vistas} />
      <div className="max-w-2xl">
        {ver === "novedad" && (
          <Tarjeta>
            <Formulario accion={registrarNovedad.bind(null, id)}>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Qué pasó">
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
                <Campo etiqueta="Galpón de destino" ayuda="Solo para traslados.">
                  <select name="galponDestinoId" defaultValue="">
                    <option value="">—</option>
                    {otros.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <Campo etiqueta="Nota">
                <input name="nota" />
              </Campo>
              <p className="text-xs text-stone-500">
                Paso a venta: las gallinas salen del galpón y suman al inventario para venderlas en los pedidos. Cuando salen todas las aves, el galpón queda vacío.
              </p>
              <Boton type="submit">Registrar</Boton>
            </Formulario>
          </Tarjeta>
        )}

        {ver === "entrada" && (
          <Tarjeta>
            <Formulario accion={entradaAves.bind(null, id)}>
              <CamposEntrada obligatoria />
              <Boton type="submit">Registrar entrada</Boton>
            </Formulario>
          </Tarjeta>
        )}

        {ver === "produccion" && lote && <Produccion lote={lote} novedades={deLote(lote.id)} huevos={huevos} hoy={hoy} />}

        {ver === "novedades" && ultimo && (
          <Novedades
            galponId={id}
            lote={ultimo}
            novedades={deLote(ultimo.id)}
            pagina={pagina}
            anular={puede(sesion.operacion, "anular")}
          />
        )}

        {ver === "anteriores" && (
          <Tabla>
            <thead>
              <tr>
                <th>Entraron</th>
                <th className="text-right">Aves</th>
                <th className="text-right">Muertes</th>
                <th className="text-right">A venta</th>
                <th>Salieron</th>
              </tr>
            </thead>
            <tbody>
              {anteriores.map((l) => {
                const propias = deLote(l.id).filter((n) => !n.anulada);
                const bajas = bajasPorTipo(propias.filter((n) => n.loteId === l.id));
                const ultima = propias.reduce<Date | null>((u, n) => (!u || n.fecha > u ? n.fecha : u), null);
                return (
                  <tr key={l.id}>
                    <td>
                      {formatoDia(l.fechaIngreso)}
                      {l.raza && <span className="block text-xs text-stone-500">{l.raza}</span>}
                    </td>
                    <td className="text-right">{avesQueEntraron(l, propias).toLocaleString("es-CO")}</td>
                    <td className="text-right">{bajas.MUERTE.toLocaleString("es-CO")}</td>
                    <td className="text-right">{bajas.VENTA.toLocaleString("es-CO")}</td>
                    <td>{ultima ? formatoDia(ultima) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}

        {ver === "datos" && (
          <Tarjeta>
            <Formulario accion={actualizarGalpon.bind(null, id)}>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Nombre">
                  <input name="nombre" defaultValue={galpon.nombre} required />
                </Campo>
                <Campo etiqueta="Capacidad (aves)">
                  <input name="capacidad" inputMode="numeric" defaultValue={galpon.capacidad ?? ""} />
                </Campo>
                {lote && (
                  <>
                    <Campo etiqueta="Etapa de las aves">
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
                  </>
                )}
              </div>
              {!lote && (
                <label className="flex items-center gap-2 font-normal">
                  <input type="checkbox" name="fueraDeUso" defaultChecked={!galpon.activo} /> Galpón fuera de uso
                </label>
              )}
              <Boton type="submit" variante="secundario">
                Guardar
              </Boton>
            </Formulario>
          </Tarjeta>
        )}
      </div>
    </>
  );
}

type Lote = { id: number; cantidadInicial: number; fechaIngreso: Date; edadIngresoSemanas: number; estado: keyof typeof ESTADO_LOTE; raza: string | null };
type Novedad = Awaited<ReturnType<typeof novedadesDe>>[number];

function Resumen({ lote, novedades, hoy, capacidad }: { lote: Lote; novedades: Novedad[]; hoy: Date; capacidad: number | null }) {
  const vivas = avesVivas(lote, novedades);
  const bajas = bajasPorTipo(novedades.filter((n) => n.loteId === lote.id));
  const base = avesQueEntraron(lote, novedades);
  const mortalidad = base > 0 ? Math.round((bajas.MUERTE / base) * 1000) / 10 : 0;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tarjeta>
        <p className="text-sm text-stone-600">Aves vivas</p>
        <p className="text-2xl font-semibold">{vivas.toLocaleString("es-CO")}</p>
        {capacidad && <p className="text-xs text-stone-500">de {capacidad.toLocaleString("es-CO")} que caben</p>}
      </Tarjeta>
      <Tarjeta>
        <p className="text-sm text-stone-600">Edad</p>
        <p className="text-2xl font-semibold">{edadSemanas(lote.fechaIngreso, lote.edadIngresoSemanas, hoy)} sem.</p>
      </Tarjeta>
      <Tarjeta>
        <p className="text-sm text-stone-600">Etapa</p>
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
  );
}

function Produccion({ lote, novedades, huevos, hoy }: { lote: Lote; novedades: Novedad[]; huevos: Map<string, number>; hoy: Date }) {
  const produccion = Array.from({ length: DIAS }, (_, i) => {
    const dia = sumarDias(hoy, -i);
    const total = huevos.get(`${lote.id}|${dia.toISOString().slice(0, 10)}`);
    const aves = avesVivas(lote, novedades, dia);
    return { dia, total, aves, postura: total === undefined ? null : porcentajePostura(total, aves) };
  }).filter((p) => p.total !== undefined);
  if (produccion.length === 0)
    return (
      <Vacio>
        Sin registros en los últimos {DIAS} días. En{" "}
        <Link href="/clasificacion" className="underline">
          Clasificación
        </Link>{" "}
        elige este galpón al registrar los huevos del día.
      </Vacio>
    );
  return (
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
  );
}

async function Novedades({ galponId, lote, novedades, pagina, anular }: { galponId: number; lote: Lote; novedades: Novedad[]; pagina: number; anular: boolean }) {
  // Todas las novedades cuentan para las aves vivas; en pantalla van por páginas.
  const ordenadas = [...novedades].sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id);
  const lista = paginar(ordenadas, pagina);
  // Solo los galpones y usuarios que aparecen en esta página.
  const [lotesVistos, usuariosVistos] = await Promise.all([
    db.lote.findMany({
      where: { id: { in: [...new Set(lista.flatMap((n) => [n.loteId, n.loteDestinoId ?? n.loteId]))] } },
      select: { id: true, galpon: { select: { nombre: true } } },
    }),
    db.usuario.findMany({ where: { id: { in: [...new Set(lista.map((n) => n.usuarioId))] } }, select: { id: true, nombre: true } }),
  ]);
  const galponDe = new Map(lotesVistos.map((l) => [l.id, l.galpon.nombre]));
  const nombreUsuario = new Map(usuariosVistos.map((u) => [u.id, u.nombre]));
  return (
    <Tarjeta>
      {lote.cantidadInicial > 0 && (
        <p className="mb-2 text-sm text-stone-600">
          Entraron {lote.cantidadInicial.toLocaleString("es-CO")} aves el {formatoDia(lote.fechaIngreso)}
          {lote.raza && ` · ${lote.raza}`}.
        </p>
      )}
      <ul className="divide-y divide-stone-100 text-sm">
        {lista.map((n) => {
          const entrada = n.loteDestinoId === lote.id;
          return (
            <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {formatoDia(n.fecha)} · {entrada ? `Traslado desde ${galponDe.get(n.loteId)}` : TIPO_NOVEDAD[n.tipo]}
                {!entrada && n.loteDestinoId && ` a ${galponDe.get(n.loteDestinoId)}`}
                {n.nota && <span className="text-stone-500"> · {n.nota}</span>}
                <span className="text-stone-400"> · {nombreUsuario.get(n.usuarioId)}</span> {n.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
              </span>
              <span className="flex items-center gap-2">
                <span className={n.anulada ? "text-stone-400 line-through" : entrada ? "text-green-700" : "text-red-700"}>
                  {entrada ? "+" : "−"}
                  {n.cantidad}
                </span>
                {!n.anulada && !entrada && anular && (
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
      <Paginacion ruta={`/aves/${galponId}`} params={{ ver: "novedades" }} pagina={pagina} total={ordenadas.length} />
    </Tarjeta>
  );
}
