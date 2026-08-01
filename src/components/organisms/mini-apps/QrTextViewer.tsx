"use client";

import { useState } from "react";
import { Button, Card, useHaptics, useSnackbar } from "lib-kit-components";
import type { QrTextPayload } from "@/lib/qr-text-payload";

const CopyIcon = ({ done }: { done: boolean }) =>
  done ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

interface QrTextViewerProps {
  payload: QrTextPayload | null;
}

/**
 * Pantalla a la que apunta el QR generado en modo "Texto" (`QrGenerator`).
 * Existe porque un QR con texto plano depende de que la app que escanea
 * ofrezca copiar — no todas lo hacen —, así que en vez de codificar el texto
 * directo, el QR codifica un link acá y esta pantalla sí garantiza copiar.
 * Copia sólo el cuerpo: título/subtítulo son el encabezado, no el contenido.
 */
export function QrTextViewer({ payload }: QrTextViewerProps) {
  const { haptic } = useHaptics();
  const { snack } = useSnackbar();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!payload) return;
    haptic("tap");
    try {
      await navigator.clipboard.writeText(payload.body);
      haptic("success");
      setCopied(true);
      snack({ message: "Texto copiado al portapapeles.", variant: "success" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      snack({ message: "No se pudo copiar. Mantené presionado el texto para copiarlo a mano.", variant: "error" });
    }
  }

  if (!payload) {
    return (
      <Card variant="outline" padding="lg" className="text-center">
        <p className="text-sm text-muted">Este enlace no tiene ningún texto para mostrar.</p>
      </Card>
    );
  }

  return (
    <Card variant="outline" padding="lg" className="space-y-4">
      {payload.title ? (
        <div>
          <p className="text-lg font-bold leading-tight text-foreground">{payload.title}</p>
          {payload.subtitle && <p className="text-sm text-muted">{payload.subtitle}</p>}
        </div>
      ) : (
        <p className="text-sm font-semibold text-foreground">Texto escaneado</p>
      )}
      <p className="whitespace-pre-wrap wrap-break-word text-base leading-relaxed">{payload.body}</p>
      <Button fullWidth leftIcon={<CopyIcon done={copied} />} onClick={copy}>
        {copied ? "¡Copiado!" : "Copiar al portapapeles"}
      </Button>
    </Card>
  );
}
