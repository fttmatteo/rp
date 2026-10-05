import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { avesPorLote, huevosPorLoteYDia } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { ESTADO_LOTE } from "@/lib/etiquetas-aves";
import { diaUTC, hoyISO, sumarDias } from "@/lib/formato";
import { requerir } from "@/lib/sesion";
import { edadSemanas, porcentajePostura } from "@/modules/aves";
import { crearGalpon, crearLote } from "./acciones";

export default async function AvesPage() {
  await requerir("aves");
  const hoy = diaUTC(hoyISO());
  const desde = sumarDias(hoy, -6);
  const [galpones, lotes] = await Promise.all([
    db.galpon.findMany({ orderBy: { nombre: "asc" } }),
    db.lote.findMany({ orderBy: [{ activo: "desc" }, { fechaIngreso: "asc" }], include: { galpon: true } }),
  ]);
  const activos = lotes.filter((l) => l.activo);
  const [vivas, huevos] = await Promise.all([
    avesPorLote(activos),
    huevosPorLoteYDia(
      activos.map((l) => l.id),
      desde,
      hoy,
    ),
  ]);
  const totalAves = activos.reduce((s, l) => s + (vivas.get(l.id) ?? 0), 0);
  // Promedio de 7 días: huevos promedio de los días con registro ÷ aves de hoy (aproximado, para ver la tendencia).
  const semana = (id: number) => {
    const dias = [...huevos].filter(([k]) => k.startsWith(`${id}|`));
    return dias.length === 0 ? null : dias.reduce((s, [, v]) => s + v, 0) / dias.length;
  };

  return (
    <>
      <Titulo>Aves</Titulo>
      <p className="mb-4">
        Aves vivas: <strong>{totalAves.toLocaleString("es-CO")}</strong> en {activos.length} lotes activos.
      </p>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          {activos.length === 0 ? (
            <Vacio>Todavía no hay lotes. Crea primero el galpón y luego el lote con sus aves.</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Estado</th>
                  <th className="text-right">Edad</th>
                  <th className="text-right">Aves</th>
                  <th className="text-right">Postura hoy</th>
                  <th className="text-right">Postura 7 días</th>
                </tr>
              </thead>
              <tbody>
                {activos.map((l) => {
                  const aves = vivas.get(l.id) ?? 0;
                  const huevosHoy = huevos.get(`${l.id}|${hoyISO()}`);
                  const promedio = semana(l.id);
                  const hoyP = huevosHoy === undefined ? null : porcentajePostura(huevosHoy, aves);
                  const semanaP = promedio === null ? null : porcentajePostura(promedio, aves);
                  return (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/aves/${l.id}`} className="underline">
                          {l.nombre}
                        </Link>
                        <span className="block text-xs text-stone-500">{l.galpon.nombre}</span>
                      </td>
                      <td>{ESTADO_LOTE[l.estado]}</td>
                      <td className="text-right">{edadSemanas(l.fechaIngreso, l.edadIngresoSemanas, hoy)} sem.</td>
                      <td className="text-right">{aves.toLocaleString("es-CO")}</td>
                      <td className="text-right">{hoyP === null ? "—" : `${hoyP}%`}</td>
                      <td className="text-right">{semanaP === null ? "—" : `${semanaP}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          )}
          <p className="text-xs text-stone-500">
            La postura sale de la clasificación diaria cuando se elige el lote: huevos clasificados más rotos ÷ aves vivas.
          </p>
          {lotes.length > activos.length && (
            <details>
              <summary className="cursor-pointer text-sm underline">Lotes cerrados</summary>
              <ul className="mt-2 text-sm">
                {lotes
                  .filter((l) => !l.activo)
                  .map((l) => (
                    <li key={l.id}>
                      <Link href={`/aves/${l.id}`} className="underline">
                        {l.nombre}
                      </Link>{" "}
                      · {l.galpon.nombre} <Etiqueta>Cerrado</Etiqueta>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>

        <div className="space-y-4">
          {galpones.length > 0 && (
            <Tarjeta titulo="Nuevo lote">
              <Formulario accion={crearLote}>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Galpón">
                    <select name="galponId" required>
                      {galpones.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Nombre del lote">
                    <input name="nombre" required placeholder="Ej.: Lote 12" />
                  </Campo>
                  <Campo etiqueta="Fecha de ingreso">
                    <input name="fechaIngreso" type="date" defaultValue={hoyISO()} max={hoyISO()} required />
                  </Campo>
                  <Campo etiqueta="Edad al ingresar (semanas)">
                    <input name="edadIngresoSemanas" inputMode="numeric" defaultValue="0" />
                  </Campo>
                  <Campo etiqueta="Aves que entraron">
                    <input name="cantidadInicial" inputMode="numeric" required />
                  </Campo>
                  <Campo etiqueta="Estado">
                    <select name="estado" defaultValue="POSTURA">
                      {Object.entries(ESTADO_LOTE).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
                <Campo etiqueta="Raza">
                  <input name="raza" />
                </Campo>
                <Campo etiqueta="Nota">
                  <input name="nota" />
                </Campo>
                <Boton type="submit">Crear lote</Boton>
              </Formulario>
            </Tarjeta>
          )}
          <Tarjeta titulo="Nuevo galpón">
            <Formulario accion={crearGalpon}>
              <Campo etiqueta="Nombre">
                <input name="nombre" required />
              </Campo>
              <Campo etiqueta="Capacidad (aves)">
                <input name="capacidad" inputMode="numeric" />
              </Campo>
              <Boton type="submit" variante="secundario">
                Crear galpón
              </Boton>
            </Formulario>
            {galpones.length > 0 && <p className="mt-3 text-sm text-stone-600">Galpones: {galpones.map((g) => g.nombre).join(", ")}</p>}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
