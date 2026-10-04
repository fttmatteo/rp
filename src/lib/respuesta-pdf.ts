import "server-only";

export function respuestaPdf(bytes: Uint8Array, nombre: string): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
