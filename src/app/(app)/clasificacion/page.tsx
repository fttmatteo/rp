import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { Boton, BotonTexto, Campo, Etiqueta, Tabla, Tarjeta, Titulo } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoCantidad, formatoDia, formatoHuevos, hoyISO } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { textoRangoGramos } from "@/modules/pesos";
import { PestanasInventario } from "../inventario/pestanas";
import { anularClasificacion, registrarClasificacion } from "./acciones";

export default async function ClasificacionPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const sesion = await requerir("clasificacion");
  const pagina = leerPagina((await searchParams).pagina);
  const [productos, registros, totalRegistros, compras, grupos] = await Promise.all([
    db.producto.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.registroClasificacion.findMany({
      orderBy: { id: "desc" },
      ...rango(pagina, 20),
      include: {
        usuario: { select: { nombre: true } },
        grupo: { select: { galpon: { select: { nombre: true } } } },
        compra: { include: { proveedor: true } },
        detalles: { include: { producto: true } },
        movimientos: { where: { tipo: "ANULACION" }, take: 1, select: { id: true } },
      },
    }),
    db.registroClasificacion.count(),
    db.compra.findMany({ where: { anulada: false, porClasificar: { gt: 0 } }, orderBy: { fecha: "asc" }, include: { proveedor: true } }),
    db.grupoAves.findMany({ where: { activo: true }, orderBy: { galpon: { nombre: "asc" } }, include: { galpon: true } }),
  ]);
  const huevos = productos.filter((p) => p.tipo === "CUBETA");
  const gallinaza = productos.filter((p) => p.tipo === "GALLINAZA");

  return (
    <>
      <Titulo>Clasificación diaria</Titulo>
      <PestanasInventario actual="/clasificacion" operacion={sesion.operacion} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Tarjeta id="registrar" titulo="Registrar clasificación">
          <Formulario accion={registrarClasificacion}>
            <Campo etiqueta="Fecha">
              <input name="fecha" type="date" defaultValue={hoyISO()} max={hoyISO()} required />
            </Campo>
            {grupos.length > 0 && (
              <Campo etiqueta="Galpón" ayuda="El galpón de donde salieron estos huevos; con él se calcula el % de postura. No aplica a huevo comprado.">
                <select name="grupo" defaultValue={grupos.length === 1 ? grupos[0].id : ""}>
                  <option value="">Sin galpón</option>
                  {grupos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.galpon.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {compras.length > 0 && (
              <Campo etiqueta="Origen del huevo" ayuda="Elige la compra si estás clasificando huevo comprado que llegó sin clasificar.">
                <select name="origen" defaultValue="">
                  <option value="">Producción propia</option>
                  {compras.map((c) => (
                    <option key={c.id} value={c.id}>
                      Compra #{c.id} a {c.proveedor.nombre} · faltan {formatoHuevos(c.porClasificar)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Tabla>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cubetas</th>
                  <th>Huevos sueltos (sin completar cubeta)</th>
                </tr>
              </thead>
              <tbody>
                {huevos.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">
                      {p.nombre}
                      {textoRangoGramos(p) && <span className="block font-normal text-stone-600">{textoRangoGramos(p)}</span>}
                    </td>
                    <td>
                      <input name={`cubetas_${p.id}`} inputMode="numeric" placeholder="0" />
                    </td>
                    <td>
                      <input name={`sueltos_${p.id}`} inputMode="numeric" placeholder="0" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            <div className="grid grid-cols-2 gap-3">
              {gallinaza.map((p) => (
                <Campo key={p.id} etiqueta={`Gallinaza recogida (${p.unidad ?? "bulto"}s)`} ayuda="Suma al inventario de gallinaza para vender.">
                  <input name={`unidades_${p.id}`} inputMode="numeric" placeholder="0" />
                </Campo>
              ))}
              <Campo etiqueta="Huevos rotos" ayuda="Solo como registro; no entran al inventario.">
                <input name="rotos" inputMode="numeric" placeholder="0" />
              </Campo>
            </div>
            <Campo etiqueta="Nota">
              <input name="nota" />
            </Campo>
            <p className="text-sm text-stone-500">Las gallinas para vender se registran en Aves, en el galpón del que salen (novedad «Paso a venta»).</p>
            <Boton type="submit">Guardar</Boton>
          </Formulario>
        </Tarjeta>

        <div>
          <h2 id="registros" className="mb-2 text-lg font-semibold">
            Registros
          </h2>
          <ul className="space-y-2">
            {registros.map((r) => (
              <li key={r.id} className="rounded border border-stone-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {formatoDia(r.fecha)}
                    {r.compra && <span className="font-normal text-stone-600"> · compra #{r.compra.id} a {r.compra.proveedor.nombre}</span>}
                  </strong>
                  <span className="text-stone-500">
                    {r.usuario.nombre} {r.movimientos.length > 0 && <Etiqueta color="rojo">Anulado</Etiqueta>}
                  </span>
                </div>
                <p>
                  {r.detalles.map((d) => `${d.producto.nombre}: ${formatoCantidad(d.producto.tipo, d.cantidad, d.producto.unidad)}`).join(" · ")}
                </p>
                {r.rotos > 0 && <p className="text-stone-500">Rotos: {r.rotos}</p>}
                {r.grupo && <p className="text-stone-500">Galpón: {r.grupo.galpon.nombre}</p>}
                {r.nota && <p className="text-stone-500">{r.nota}</p>}
                {puede(sesion.operacion, "anular") && r.movimientos.length === 0 && (
                  <Formulario accion={anularClasificacion.bind(null, r.id)} confirmar="¿Anular este registro? Sus cantidades salen del inventario." className="mt-1">
                    <BotonTexto type="submit" peligro>
                      Anular registro
                    </BotonTexto>
                  </Formulario>
                )}
              </li>
            ))}
          </ul>
          <Paginacion ruta="/clasificacion" pagina={pagina} total={totalRegistros} porPagina={20} ancla="registros" />
        </div>
      </div>
    </>
  );
}
