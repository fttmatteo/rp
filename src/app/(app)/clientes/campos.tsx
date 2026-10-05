import { Campo } from "@/components/ui";

interface Datos {
  nombre?: string;
  telefono?: string | null;
  direccion?: string | null;
  zona?: string | null;
  latitud?: number | null;
  longitud?: number | null;
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
      <Campo etiqueta="Latitud (opcional)" ayuda="Ubicación GPS para que el repartidor abra la parada en Google Maps. Sin ella se usa la dirección.">
        <input name="latitud" inputMode="decimal" defaultValue={c.latitud ?? ""} placeholder="4.6097" />
      </Campo>
      <Campo etiqueta="Longitud (opcional)" ayuda="En Google Maps, mantén presionado el punto y copia los dos números.">
        <input name="longitud" inputMode="decimal" defaultValue={c.longitud ?? ""} placeholder="-74.0817" />
      </Campo>
      <Campo etiqueta="Cupo de crédito" ayuda="Lo máximo que puede deber. Vacío = sin límite. Si lo supera, sale un aviso, pero se le puede seguir vendiendo.">
        <input name="cupoCredito" inputMode="numeric" defaultValue={c.cupoCredito ?? ""} />
      </Campo>
      <Campo etiqueta="Días de crédito" ayuda="Plazo para pagar un fiado. Pasado ese plazo, la deuda se marca como vencida. Si lo cambias, solo aplica a las ventas nuevas.">
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
