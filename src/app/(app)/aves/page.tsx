import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { avesPorGrupo, huevosPorGrupoYDia } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { ETAPA_AVES } from "@/lib/etiquetas-aves";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { edadSemanas, porcentajePostura } from "@/modules/aves";
import { PestanasInventario } from "../inventario/pestanas";
import { crearGalpon } from "./acciones";
import { CamposEntrada } from "./campos-entrada";

export default async function AvesPage() {
  const sesion = await requerir("aves");
  const hoy = diaUTC(hoyISO());
  const desde = sumarDias(hoy, -6);
  // Los galpones son pocos: se muestran todos, cada uno con las aves que tiene hoy (su grupo activo).
  const galpones = await db.galpon.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { grupos: { where: { activo: true }, take: 1 } },
  });
  const grupos = galpones.flatMap((g) => g.grupos);
  const [vivas, huevos] = await Promise.all([
    avesPorGrupo(grupos),
    huevosPorGrupoYDia(
      grupos.map((l) => l.id),
      desde,
      hoy,
    ),
  ]);
  const totalAves = grupos.reduce((s, l) => s + (vivas.get(l.id) ?? 0), 0);
  // Promedio de 7 días: huevos promedio de los días con registro ÷ aves de hoy (aproximado, para ver la tendencia).
  const semana = (id: number) => {
    const dias = [...huevos].filter(([k]) => k.startsWith(`${id}|`));
    return dias.length === 0 ? null : dias.reduce((s, [, v]) => s + v, 0) / dias.length;
  };

  return (
    <>
      <Titulo>Aves</Titulo>
      <PestanasInventario actual="/aves" operacion={sesion.operacion} />
      <p className="mb-4">
        Aves vivas: <strong>{totalAves.toLocaleString("es-CO")}</strong> en {grupos.length} de {galpones.filter((g) => g.activo).length} galpones.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-2">
          {galpones.length === 0 ? (
            <Vacio>Todavía no hay galpones. Crea el primero con las aves que tiene.</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  {/* En el celular quedan Galpón (con etapa y edad debajo), Aves y Postura hoy. */}
                  <th>Galpón</th>
                  <th className="hidden sm:table-cell">Etapa</th>
                  <th className="hidden text-right sm:table-cell">Edad</th>
                  <th className="text-right">Aves</th>
                  <th className="text-right">Postura hoy</th>
                  <th className="hidden text-right sm:table-cell">Postura 7 días</th>
                </tr>
              </thead>
              <tbody>
                {galpones.map((g) => {
                  const l = g.grupos[0];
                  const nombre = (
                    <Link href={`/aves/${g.id}`} className="underline">
                      {g.nombre}
                    </Link>
                  );
                  if (!l)
                    return (
                      <tr key={g.id}>
                        <td>{nombre}</td>
                        {/* Una celda por diseño: en el celular solo quedan dos columnas después del galpón. */}
                        <td colSpan={2} className="sm:hidden">
                          <Etiqueta>{g.activo ? "Vacío" : "Fuera de uso"}</Etiqueta>
                        </td>
                        <td colSpan={5} className="hidden sm:table-cell">
                          <Etiqueta>{g.activo ? "Vacío" : "Fuera de uso"}</Etiqueta>
                        </td>
                      </tr>
                    );
                  const aves = vivas.get(l.id) ?? 0;
                  const huevosHoy = huevos.get(`${l.id}|${hoyISO()}`);
                  const promedio = semana(l.id);
                  const hoyP = huevosHoy === undefined ? null : porcentajePostura(huevosHoy, aves);
                  const semanaP = promedio === null ? null : porcentajePostura(promedio, aves);
                  return (
                    <tr key={g.id}>
                      <td>
                        {nombre}
                        <span className="block text-stone-600 sm:hidden">
                          {ETAPA_AVES[l.etapa]} · {edadSemanas(l.fechaIngreso, l.edadIngresoSemanas, hoy)} sem.
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">{ETAPA_AVES[l.etapa]}</td>
                      <td className="hidden text-right tabular-nums sm:table-cell">{edadSemanas(l.fechaIngreso, l.edadIngresoSemanas, hoy)} sem.</td>
                      <td className="text-right tabular-nums">{aves.toLocaleString("es-CO")}</td>
                      <td className="text-right tabular-nums">{hoyP === null ? "—" : `${hoyP}%`}</td>
                      <td className="hidden text-right tabular-nums sm:table-cell">{semanaP === null ? "—" : `${semanaP}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          )}
          <p className="text-stone-500">
            Entra a un galpón para registrar muertes, ventas o traslados. La postura sale de la clasificación diaria: huevos clasificados más rotos ÷ aves
            vivas.
          </p>
        </div>

        <Tarjeta id="nuevo-galpon" titulo="Nuevo galpón">
          <Formulario accion={crearGalpon}>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Nombre">
                <input name="nombre" required placeholder="Ej.: Galpón 7" />
              </Campo>
              <Campo etiqueta="Capacidad (aves)">
                <input name="capacidad" inputMode="numeric" />
              </Campo>
            </div>
            <p className="text-stone-600">Si ya tiene aves, escribe cuántas. Si no, déjalo vacío y regístralas cuando lleguen.</p>
            <CamposEntrada obligatoria={false} />
            <Boton type="submit">Crear galpón</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
