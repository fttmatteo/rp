import { Campo } from "@/components/ui";

export function CamposProveedor({
  p = {},
}: {
  p?: { nombre?: string; telefono?: string | null; notas?: string | null; diasCredito?: number };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre">
        <input name="nombre" defaultValue={p.nombre} required />
      </Campo>
      <Campo etiqueta="Teléfono">
        <input name="telefono" type="tel" defaultValue={p.telefono ?? ""} />
      </Campo>
      <Campo etiqueta="Días de crédito" ayuda="Plazo para pagarle una compra a crédito.">
        <input name="diasCredito" inputMode="numeric" defaultValue={p.diasCredito ?? 15} required />
      </Campo>
      <Campo etiqueta="Notas">
        <input name="notas" defaultValue={p.notas ?? ""} />
      </Campo>
    </div>
  );
}
