"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { EstadoForm } from "@/lib/form";
import { Alerta } from "@/components/ui";

type Accion = (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;

/**
 * Formulario que muestra el error o la confirmación devuelta por la acción del servidor.
 * Si hay error, conserva lo escrito para corregirlo; si sale bien, se limpia.
 */
export function Formulario({
  accion,
  children,
  className = "space-y-4",
  confirmar,
  id,
}: {
  accion: Accion;
  children: ReactNode;
  className?: string;
  /** Pregunta antes de enviar (para anulaciones y cancelaciones). */
  confirmar?: string;
  /** Para asociar campos que están fuera del formulario (atributo form="..."). */
  id?: string;
}) {
  const [estado, enviar, enviando] = useActionState(accion, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    // Se envía a mano para que React no limpie el formulario cuando hay un error.
    e.preventDefault();
    if (confirmar && !window.confirm(confirmar)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const datos = new FormData(e.currentTarget, submitter);
    startTransition(() => enviar(datos));
  }

  // El espaciado (space-y-*) del formulario solo alcanza a sus hijos directos: la alerta y el fieldset. Para que
  // también separe los campos, el fieldset lo repite; si no hay espaciado (formularios en línea) no ocupa caja.
  const espaciado = className.match(/\bspace-y-\S+/)?.[0];

  return (
    <form ref={ref} id={id} action={enviar} onSubmit={alEnviar} className={className}>
      {estado?.error && <Alerta>{estado.error}</Alerta>}
      {estado?.ok && <Alerta tipo="ok">{estado.ok}</Alerta>}
      <fieldset disabled={enviando} className={espaciado ? `min-w-0 ${espaciado}` : "contents"}>
        {children}
      </fieldset>
    </form>
  );
}
