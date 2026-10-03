import { Campo } from "@/components/ui";

interface Datos {
  nombre?: string;
  telefono?: string | null;
  direccion?: string | null;
  zona?: string | null;
  cupoCredito?: number | null;
  diasCredito?: number;
  notas?: string | null;
}

export function CamposCliente({ c = {} }: { c?: Datos }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre">
        <input name="nombre" defaultValue={c.nombre} required />
      </Campo>
      <Campo etiqueta="Teléfono / WhatsApp">
        <input name="telefono" type="tel" defaultValue={c.telefono ?? ""} />
      </Campo>
      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={c.direccion ?? ""} />
      </Campo>
      <Campo etiqueta="Barrio o zona">
        <input name="zona" defaultValue={c.zona ?? ""} />
      </Campo>
      <Campo etiqueta="Cupo de crédito" ayuda="Vacío = sin límite. Si se supera, se muestra un aviso.">
        <input name="cupoCredito" inputMode="numeric" defaultValue={c.cupoCredito ?? ""} />
      </Campo>
      <Campo etiqueta="Días de crédito">
        <input name="diasCredito" inputMode="numeric" defaultValue={c.diasCredito ?? 15} required />
      </Campo>
      <div className="sm:col-span-2">
        <Campo etiqueta="Notas">
          <textarea name="notas" rows={2} defaultValue={c.notas ?? ""} />
        </Campo>
      </div>
    </div>
  );
}
