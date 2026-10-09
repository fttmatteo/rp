import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, paginar } from "@/components/paginacion";
import { Boton, BotonLink, BotonTexto, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio, vistaElegida, Vistas } from "@/components/ui";
import { huevosPorGrupoYDia, novedadesDe } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { ETAPA_AVES, TIPO_NOVEDAD } from "@/lib/etiquetas-aves";
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
    ? await db.galpon.findUnique({ where: { id }, include: { grupos: { orderBy: [{ fechaIngreso: "desc" }, { id: "desc" }] } } })
    : null;
  if (!galpon) notFound();
  // Las aves de hoy son el grupo activo; los cerrados son aves que ya salieron del galpón.
  const grupo = galpon.grupos.find((l) => l.activo) ?? null;
  const anteriores = galpon.grupos.filter((l) => !l.activo);
  // Las novedades que se ven (y se pueden anular) son las de las aves de hoy o, si está vacío, las de las últimas que salieron.
  const ultimo = grupo ?? anteriores[0] ?? null;
  const hoy = diaUTC(hoyISO());
  const desde = sumarDias(hoy, -(DIAS - 1));
  const [novedades, otros, huevos] = await Promise.all([
    novedadesDe(galpon.grupos.map((l) => l.id)),
    grupo ? db.galpon.findMany({ where: { activo: true, id: { not: id } }, orderBy: { nombre: "asc" } }) : [],
    grupo ? huevosPorGrupoYDia([grupo.id], desde, hoy) : new Map<string, number>(),
  ]);
  const deGrupo = (grupoId: number) => novedades.filter((n) => n.grupoId === grupoId || n.grupoDestinoId === grupoId);

  // Una parte a la vez; con aves se abre en la novedad, que es lo que más se registra.
  const vistas = [
    grupo && { clave: "novedad", texto: "Registrar novedad" },
    !grupo && galpon.activo && { clave: "entrada", texto: "Entrada de aves" },
    grupo && { clave: "produccion", texto: "Producción" },
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
        {galpon.nombre} {!grupo && <Etiqueta>{galpon.activo ? "Vacío" : "Fuera de uso"}</Etiqueta>}
      </Titulo>
      {grupo ? <Resumen grupo={grupo} novedades={deGrupo(grupo.id)} hoy={hoy} capacidad={galpon.capacidad} /> : <p className="mb-4 text-stone-600">Este galpón no tiene aves.</p>}

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
              <p className="text-sm text-stone-500">
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

        {ver === "produccion" && grupo && <Produccion grupo={grupo} novedades={deGrupo(grupo.id)} huevos={huevos} hoy={hoy} />}

        {ver === "novedades" && ultimo && (
          <Novedades
            galponId={id}
            grupo={ultimo}
            novedades={deGrupo(ultimo.id)}
            pagina={pagina}
            anular={puede(sesion.operacion, "anular")}
          />
        )}

        {ver === "anteriores" && (
          <Tabla>
            <thead>
              <tr>
                {/* En el celular quedan Entraron, Aves y Muertes; lo que pasó a venta y la salida, desde 640px. */}
                <th>Entraron</th>
                <th className="text-right">Aves</th>
                <th className="text-right">Muertes</th>
                <th className="hidden text-right sm:table-cell">A venta</th>
                <th className="hidden sm:table-cell">Salieron</th>
              </tr>
            </thead>
            <tbody>
              {anteriores.map((l) => {
                const propias = deGrupo(l.id).filter((n) => !n.anulada);
                const bajas = bajasPorTipo(propias.filter((n) => n.grupoId === l.id));
                const ultima = propias.reduce<Date | null>((u, n) => (!u || n.fecha > u ? n.fecha : u), null);
                return (
                  <tr key={l.id}>
                    <td>
                      {formatoDia(l.fechaIngreso)}
                      {l.raza && <span className="block text-stone-600">{l.raza}</span>}
                    </td>
                    <td className="text-right tabular-nums">{avesQueEntraron(l, propias).toLocaleString("es-CO")}</td>
                    <td className="text-right tabular-nums">{bajas.MUERTE.toLocaleString("es-CO")}</td>
                    <td className="hidden text-right tabular-nums sm:table-cell">{bajas.VENTA.toLocaleString("es-CO")}</td>
                    <td className="hidden sm:table-cell">{ultima ? formatoDia(ultima) : "—"}</td>
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
                {grupo && (
                  <>
                    <Campo etiqueta="Etapa de las aves">
                      <select name="etapa" defaultValue={grupo.etapa}>
                        {Object.entries(ETAPA_AVES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo etiqueta="Nota">
                      <input name="nota" defaultValue={grupo.nota ?? ""} />
                    </Campo>
                  </>
                )}
              </div>
              {!grupo && (
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

type GrupoAves = { id: number; cantidadInicial: number; fechaIngreso: Date; edadIngresoSemanas: number; etapa: keyof typeof ETAPA_AVES; raza: string | null };
type Novedad = Awaited<ReturnType<typeof novedadesDe>>[number];

function Resumen({ grupo, novedades, hoy, capacidad }: { grupo: GrupoAves; novedades: Novedad[]; hoy: Date; capacidad: number | null }) {
  const vivas = avesVivas(grupo, novedades);
  const bajas = bajasPorTipo(novedades.filter((n) => n.grupoId === grupo.id));
  const base = avesQueEntraron(grupo, novedades);
  const mortalidad = base > 0 ? Math.round((bajas.MUERTE / base) * 1000) / 10 : 0;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tarjeta>
        <p className="text-stone-600">Aves vivas</p>
        <p className="text-2xl font-semibold tabular-nums">{vivas.toLocaleString("es-CO")}</p>
        {capacidad && <p className="text-sm text-stone-500">de {capacidad.toLocaleString("es-CO")} que caben</p>}
      </Tarjeta>
      <Tarjeta>
        <p className="text-stone-600">Edad</p>
        <p className="text-2xl font-semibold tabular-nums">{edadSemanas(grupo.fechaIngreso, grupo.edadIngresoSemanas, hoy)} sem.</p>
      </Tarjeta>
      <Tarjeta>
        <p className="text-stone-600">Etapa</p>
        <p className="text-2xl font-semibold tabular-nums">{ETAPA_AVES[grupo.etapa]}</p>
      </Tarjeta>
      <Tarjeta>
        <p className="text-stone-600">Mortalidad acumulada</p>
        <p className="text-2xl font-semibold tabular-nums">{mortalidad}%</p>
        <p className="text-sm text-stone-500">
          {bajas.MUERTE} muertes · {bajas.DESCARTE} descartes · {bajas.VENTA} a venta
        </p>
      </Tarjeta>
    </div>
  );
}

function Produccion({ grupo, novedades, huevos, hoy }: { grupo: GrupoAves; novedades: Novedad[]; huevos: Map<string, number>; hoy: Date }) {
  const produccion = Array.from({ length: DIAS }, (_, i) => {
    const dia = sumarDias(hoy, -i);
    const total = huevos.get(`${grupo.id}|${dia.toISOString().slice(0, 10)}`);
    const aves = avesVivas(grupo, novedades, dia);
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
            <td className="text-right tabular-nums">{p.total?.toLocaleString("es-CO")}</td>
            <td className="text-right tabular-nums">{p.aves.toLocaleString("es-CO")}</td>
            <td className="text-right tabular-nums">{p.postura === null ? "—" : `${p.postura}%`}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

async function Novedades({ galponId, grupo, novedades, pagina, anular }: { galponId: number; grupo: GrupoAves; novedades: Novedad[]; pagina: number; anular: boolean }) {
  // Todas las novedades cuentan para las aves vivas; en pantalla van por páginas.
  const ordenadas = [...novedades].sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id);
  const lista = paginar(ordenadas, pagina);
  // Solo los galpones y usuarios que aparecen en esta página.
  const [gruposVistos, usuariosVistos] = await Promise.all([
    db.grupoAves.findMany({
      where: { id: { in: [...new Set(lista.flatMap((n) => [n.grupoId, n.grupoDestinoId ?? n.grupoId]))] } },
      select: { id: true, galpon: { select: { nombre: true } } },
    }),
    db.usuario.findMany({ where: { id: { in: [...new Set(lista.map((n) => n.usuarioId))] } }, select: { id: true, nombre: true } }),
  ]);
  const galponDe = new Map(gruposVistos.map((l) => [l.id, l.galpon.nombre]));
  const nombreUsuario = new Map(usuariosVistos.map((u) => [u.id, u.nombre]));
  return (
    <Tarjeta>
      {grupo.cantidadInicial > 0 && (
        <p className="mb-2 text-stone-600">
          Entraron {grupo.cantidadInicial.toLocaleString("es-CO")} aves el {formatoDia(grupo.fechaIngreso)}
          {grupo.raza && ` · ${grupo.raza}`}.
        </p>
      )}
      <ul className="divide-y divide-stone-100">
        {lista.map((n) => {
          const entrada = n.grupoDestinoId === grupo.id;
          return (
            <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {formatoDia(n.fecha)} · {entrada ? `Traslado desde ${galponDe.get(n.grupoId)}` : TIPO_NOVEDAD[n.tipo]}
                {!entrada && n.grupoDestinoId && ` a ${galponDe.get(n.grupoDestinoId)}`}
                {n.nota && <span className="text-stone-500"> · {n.nota}</span>}
                <span className="text-stone-500"> · {nombreUsuario.get(n.usuarioId)}</span> {n.anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
              </span>
              <span className="flex items-center gap-2">
                <span className={`tabular-nums ${n.anulada ? "text-stone-500 line-through" : entrada ? "text-green-700" : "text-red-700"}`}>
                  {entrada ? "+" : "−"}
                  {n.cantidad}
                </span>
                {!n.anulada && !entrada && anular && (
                  <Formulario accion={anularNovedad.bind(null, n.id)} confirmar="¿Anular esta novedad?" className="inline">
                    <BotonTexto type="submit" peligro>
                      Anular
                    </BotonTexto>
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
