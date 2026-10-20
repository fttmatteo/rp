import { Formulario } from "@/components/formulario";
import { leerPagina, Paginacion, rango } from "@/components/paginacion";
import { PestanasPedidos } from "@/components/secciones";
import { Boton, BotonLink, Etiqueta, Tabla, Titulo, Vacio } from "@/components/ui";
import { db } from "@/lib/db";
import { formatoDia, nombreProducto } from "@/lib/formato";
import { puede } from "@/lib/permisos";
import { requerir } from "@/lib/sesion";
import { textoDias } from "@/modules/recurrentes";
import { terminarRecurrente } from "../acciones";

export default async function RecurrentesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const sesion = await requerir("pedidos.ver");
  const params = await searchParams;
  const pagina = leerPagina(params.pagina);
  const puedeTerminar = puede(sesion.operacion, "pedidos.crear");
  const [recurrentes, total] = await Promise.all([
    db.pedidoRecurrente.findMany({
      // Primero los que siguen repitiéndose.
      orderBy: [{ activo: "desc" }, { cliente: { nombre: "asc" } }, { id: "asc" }],
      ...rango(pagina),
      include: { cliente: { select: { nombre: true } }, detalles: { include: { producto: true }, orderBy: { id: "asc" } } },
    }),
    db.pedidoRecurrente.count(),
  ]);

  return (
    <>
      <Titulo accion={<BotonLink href="/pedidos" variante="secundario">Volver</BotonLink>}>Pedidos recurrentes</Titulo>
      <PestanasPedidos actual="/pedidos" operacion={sesion.operacion} />
      <p className="mb-4 text-stone-600">
        Cada día elegido el pedido se carga solo a Pedidos como &quot;por aprobar&quot;. Para crear uno, haz un pedido nuevo y elige los días en
        &quot;Repetir este pedido cada semana&quot;.
      </p>
      {recurrentes.length === 0 ? (
        <Vacio>Todavía no hay pedidos recurrentes.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Se repite</th>
              <th className="hidden sm:table-cell">Productos</th>
              <th>Estado</th>
              {puedeTerminar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {recurrentes.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.cliente.nombre}
                  {r.nota && <span className="block text-stone-600">{r.nota}</span>}
                </td>
                <td>
                  Cada {textoDias(r.diasSemana)}
                  <span className="block text-stone-600">Desde el {formatoDia(r.desde)}</span>
                </td>
                <td className="hidden text-stone-600 sm:table-cell">{r.detalles.map((d) => `${d.cantidad} ${nombreProducto(d.producto)}`).join(", ")}</td>
                <td>{r.activo ? <Etiqueta color="verde">Se repite</Etiqueta> : <Etiqueta color="gris">Terminado</Etiqueta>}</td>
                {puedeTerminar && (
                  <td>
                    {r.activo && (
                      <Formulario accion={terminarRecurrente.bind(null, r.id)} confirmar="¿Dejar de repetir este pedido? Lo que ya está en Pedidos sigue igual." className="">
                        <Boton type="submit" variante="peligro">
                          Dejar de repetir
                        </Boton>
                      </Formulario>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <Paginacion ruta="/pedidos/recurrentes" params={params} pagina={pagina} total={total} />
    </>
  );
}
