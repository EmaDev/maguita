import type { Metadata } from "next";
import { OfflineScreen } from "./OfflineScreen";

export const metadata: Metadata = { title: "Sin conexión" };

/**
 * Fallback de navegación del service worker: se precachea en el `install`, así
 * que es la única pantalla garantizada cuando no hay red ni copia de la ruta
 * pedida. No lee cookies a propósito — tiene que poder renderizarse estática.
 */
export default function OfflinePage() {
  return <OfflineScreen />;
}
