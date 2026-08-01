import type { Metadata } from "next";
import { QrGenerator } from "@/components/organisms/mini-apps/QrGenerator";

export const metadata: Metadata = {
  title: "Generador de QR",
  description: "Convertí un enlace en un QR estilizado, con título y subtítulo.",
};

/** Mini-app pública: no requiere sesión. */
export default function GeneradorQrPage() {
  return <QrGenerator />;
}
