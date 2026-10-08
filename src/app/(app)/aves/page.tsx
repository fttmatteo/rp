import Link from "next/link";
import { Formulario } from "@/components/formulario";
import { Boton, Campo, Etiqueta, Tabla, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { avesPorLote, huevosPorLoteYDia } from "@/lib/aves-db";
import { db } from "@/lib/db";
import { ESTADO_LOTE } from "@/lib/etiquetas-aves";
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
  // Los galpones son pocos: se muestran todos, cada uno con las aves que tiene hoy (su lote activo).
  const galpones = await db.galpon.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { lotes: { where: { activo: true }, take: 1 } },
  });
  const lotes = galpones.flatMap((g) => g.lotes);
  const [vivas, huevos] = await Promise.all([
    avesPorLote(lotes),
    huevosPorLoteYDia(
      lotes.map((l) => l.id),
      desde,
      hoy,
    ),
  ]);
  const totalAves = lotes.reduce((s, l) => s + (vivas.get(l.id) ?? 0), 0);
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
        Aves vivas: <strong>{totalAves.toLocaleString("es-CO")}</strong> en {lotes.length} de {galpones.filter((g) => g.activo).length} galpones.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-2">
          {galpones.length === 0 ? (
            <Vacio>Todavía no hay galpones. Crea el primero con las aves que tiene.</Vacio>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <th>Galpón</th>
                  <th>Etapa</th>
                  <th className="text-right">Edad</th>
                  <th className="text-right">Aves</th>
                  <th className="text-right">Postura hoy</th>
                  <th className="text-right">Postura 7 días</th>
                </tr>
              </thead>
              <tbody>
                {galpones.map((g) => {
                  const l = g.lotes[0];
                  const nombre = (
                    <Link href={`/aves/${g.id}`} className="underline">
                      {g.nombre}
                    </Link>
                  );
                  if (!l)
                    return (
                      <tr key={g.id}>
                        <td>{nombre}</td>
                        <td colSpan={5}>
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
                      <td>{nombre}</td>
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
            <p className="text-sm text-stone-600">Si ya tiene aves, escribe cuántas. Si no, déjalo vacío y regístralas cuando lleguen.</p>
            <CamposEntrada obligatoria={false} />
            <Boton type="submit">Crear galpón</Boton>
          </Formulario>
        </Tarjeta>
      </div>
    </>
  );
}
