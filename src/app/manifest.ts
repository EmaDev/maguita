import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE, ROUTES } from "@/lib/app-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_TAGLINE,
    // Arranca en Inicio: si no hay sesión, el proxy manda a /login.
    start_url: ROUTES.inicio,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#8a1538",
    lang: "es",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable con padding propio: Android le recorta la forma que quiera.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mini-apps", url: ROUTES.miniApps, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Asistente", url: ROUTES.asistente, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
