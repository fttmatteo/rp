import Link from "next/link";
import paquete from "../../package.json";

export const NOMBRE_SOFTWARE = "RP Software";
export const VERSION = paquete.version;
export const AUTOR = {
  nombre: "fttmatteo",
  url: "https://github.com/fttmatteo",
};

export function EnlaceAutor({ className = "underline" }: { className?: string }) {
  return (
    <a href={AUTOR.url} target="_blank" rel="noopener noreferrer" className={className}>
      {AUTOR.nombre}
    </a>
  );
}

/** Pie de las pantallas: derechos y enlace a "Acerca de" (o al autor, donde no hay sesión). */
export function PieCreditos({ conAcerca = true }: { conAcerca?: boolean }) {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-6 text-center text-sm text-stone-500">
      © {new Date().getFullYear()} {NOMBRE_SOFTWARE}. Todos los derechos reservados. ·{" "}
      {conAcerca ? (
        <Link href="/acerca" className="underline">
          Acerca de
        </Link>
      ) : (
        <>
          Hecho por <EnlaceAutor />
        </>
      )}
    </footer>
  );
}
