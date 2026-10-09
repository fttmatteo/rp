import { Campo } from "@/components/ui";
import { ETAPA_AVES } from "@/lib/etiquetas-aves";
import { hoyISO } from "@/lib/formato";

/** Campos de una entrada de aves a un galpón (al crearlo o cuando está vacío). */
export function CamposEntrada({ obligatoria }: { obligatoria: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Campo etiqueta="Aves que entraron">
        <input name="cantidadInicial" inputMode="numeric" required={obligatoria} />
      </Campo>
      <Campo etiqueta="Fecha de entrada">
        <input name="fechaIngreso" type="date" defaultValue={hoyISO()} max={hoyISO()} />
      </Campo>
      <Campo etiqueta="Edad al entrar (semanas)">
        <input name="edadIngresoSemanas" inputMode="numeric" defaultValue="0" />
      </Campo>
      <Campo etiqueta="Etapa">
        <select name="etapa" defaultValue="POSTURA">
          {Object.entries(ETAPA_AVES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Raza">
        <input name="raza" />
      </Campo>
    </div>
  );
}
