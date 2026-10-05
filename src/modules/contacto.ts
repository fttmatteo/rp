// Enlaces para llamar, escribir por WhatsApp y abrir la dirección en Google Maps.
// WhatsApp se usa con enlaces wa.me (el usuario revisa y pulsa Enviar); nada se envía solo.

const INDICATIVO = "57"; // Colombia

/** Número para wa.me: solo dígitos y con indicativo. Un celular colombiano de 10 dígitos recibe el 57. */
export function telefonoInternacional(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) return INDICATIVO + digitos;
  if (digitos.length < 7) return null;
  return digitos;
}

export function enlaceWhatsApp(telefono: string | null | undefined, mensaje?: string): string | null {
  const numero = telefonoInternacional(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

export function enlaceLlamar(telefono: string | null | undefined): string | null {
  const digitos = telefono?.replace(/[^\d+]/g, "");
  return digitos ? `tel:${digitos}` : null;
}

/** Google Maps con la ubicación GPS si la hay; si no, con la dirección y el barrio. */
export function enlaceMaps(c: {
  latitud?: number | null;
  longitud?: number | null;
  direccion?: string | null;
  zona?: string | null;
}): string | null {
  const consulta =
    c.latitud != null && c.longitud != null ? `${c.latitud},${c.longitud}` : [c.direccion, c.zona].filter(Boolean).join(", ");
  if (!consulta) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
