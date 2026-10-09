import { Campo } from "@/components/ui";
import { ETIQUETA_OPERACION, OPERACIONES } from "@/lib/permisos";

export function CamposAccesos({ actuales = [] }: { actuales?: string[] }) {
  return (
    <fieldset>
      <legend className="font-medium text-stone-700">Accesos</legend>
      {OPERACIONES.map((op) => (
        <label key={op} className="flex min-h-11 items-center gap-2 font-normal">
          <input type="checkbox" name="accesos" value={op} defaultChecked={actuales.includes(op)} />
          {ETIQUETA_OPERACION[op]}
        </label>
      ))}
    </fieldset>
  );
}

export function CampoNombre({ valor }: { valor?: string }) {
  return (
    <Campo etiqueta="Nombre">
      <input name="nombre" defaultValue={valor} required />
    </Campo>
  );
}
