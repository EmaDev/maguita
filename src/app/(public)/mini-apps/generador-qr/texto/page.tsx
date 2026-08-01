import type { Metadata } from "next";
import { QrTextViewer } from "@/components/organisms/mini-apps/QrTextViewer";
import { parseQrTextPayload } from "@/lib/qr-text-payload";

export const metadata: Metadata = {
  title: "Texto escaneado",
  description: "Copiá el texto que compartieron con vos por QR.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Mini-app pública: no requiere sesión. Es el destino del QR generado en
 * modo "Texto" por `QrGenerator` — no un formulario de carga.
 */
export default async function QrTextoPage(props: PageProps<"/mini-apps/generador-qr/texto">) {
  // En Next.js 16 `searchParams` es asíncrono: el acceso sincrónico se removió.
  const params = await props.searchParams;
  const payload = parseQrTextPayload(first(params.d), first(params.t));

  return <QrTextViewer payload={payload} />;
}
