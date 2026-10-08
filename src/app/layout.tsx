import type { Metadata, Viewport } from "next";
import "./globals.css";

/** Pantalla de carga de iPhone al abrir la app desde el inicio: [ancho, alto, densidad, archivo vertical, archivo horizontal]. */
const SPLASH = [
  [390, 844, 3, "1170x2532", "2532x1170"],
  [430, 932, 3, "1290x2796", "2796x1290"],
  [375, 667, 2, "750x1334", "1334x750"],
] as const;

export const metadata: Metadata = {
  title: "RP Huevos Campesinos",
  description: "Gestión de producción, inventario, ventas y cartera",
  // El favicon.ico de esta carpeta lo agrega Next solo; aquí van los demás tamaños.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "RP",
    statusBarStyle: "default",
    startupImage: SPLASH.flatMap(([ancho, alto, densidad, vertical, horizontal]) => {
      const pantalla = `(device-width: ${ancho}px) and (device-height: ${alto}px) and (-webkit-device-pixel-ratio: ${densidad})`;
      return [
        { url: `/icons/splash/splash-${vertical}.png`, media: `${pantalla} and (orientation: portrait)` },
        { url: `/icons/splash/splash-${horizontal}.png`, media: `${pantalla} and (orientation: landscape)` },
      ];
    }),
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#A63F1C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
