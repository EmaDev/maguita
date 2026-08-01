/** Forma del payload que `QrGenerator` codifica en el QR de modo "Texto". */
export interface QrTextPayload {
  title?: string;
  subtitle?: string;
  body: string;
}

/**
 * Intenta leer el parámetro `d` (JSON: título/subtítulo/cuerpo) del QR
 * nuevo; si no es JSON válido con `body`, lo trata como el parámetro `t`
 * legado (texto plano, sin título/subtítulo) de la primera versión de esta
 * pantalla.
 *
 * Vive fuera de `QrTextViewer` (que es `"use client"`) a propósito: la
 * página que arma el payload es un Server Component, y Next no permite
 * invocar ahí una función exportada desde un módulo cliente.
 */
export function parseQrTextPayload(d: string | undefined, t: string | undefined): QrTextPayload | null {
  if (d) {
    try {
      const parsed: unknown = JSON.parse(d);
      if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).body === "string") {
        const { title, subtitle, body } = parsed as Record<string, unknown>;
        return {
          title: typeof title === "string" ? title : undefined,
          subtitle: typeof subtitle === "string" ? subtitle : undefined,
          body: body as string,
        };
      }
    } catch {
      /* cae al legado de abajo */
    }
  }
  if (t) return { body: t };
  return null;
}
