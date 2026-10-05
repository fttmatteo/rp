"use server";

import { redirect } from "next/navigation";
import { mensajeError, type EstadoForm } from "@/lib/form";
import { ETIQUETA_OPERACION, esOperacion, tieneAcceso } from "@/lib/permisos";
import { elegirOperacion, requerirSesion } from "@/lib/sesion";

export async function seleccionarOperacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const sesion = await requerirSesion();
  const operacion = form.get("operacion");
  if (!esOperacion(operacion)) return { error: "Operación no válida." };
  if (!tieneAcceso(sesion.usuario.accesos, operacion)) {
    return {
      error: `Acceso denegado: el administrador no te ha asignado el acceso de ${ETIQUETA_OPERACION[operacion]}.`,
    };
  }
  try {
    await elegirOperacion(sesion.sesionId, operacion);
  } catch (e) {
    return { error: mensajeError(e) };
  }
  redirect("/");
}
