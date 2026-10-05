/** Texto en minúsculas y sin tildes, para comparar búsquedas (versión del servidor). */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
