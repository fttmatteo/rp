import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

let logo: Promise<Uint8Array> | undefined;

/** Logo horizontal sin fondo (PNG) para recibos y reportes. Se lee una sola vez; en Docker, public/ queda junto a server.js. */
export const leerLogo = () => (logo ??= readFile(path.join(process.cwd(), "public/icons/logo-recibo.png")));
