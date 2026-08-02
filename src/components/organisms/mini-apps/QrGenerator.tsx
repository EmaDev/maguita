"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Bebas_Neue, Playfair_Display, Poppins, Space_Mono } from "next/font/google";
import QRCodeStyling, { type DotType, type Options as QrOptions } from "qr-code-styling";
import {
  Button,
  Card,
  ColorPicker,
  Input,
  Select,
  TabsGlow,
  Textarea,
  useHaptics,
  useSnackbar,
  type SelectOption,
} from "lib-kit-components";
import { ROUTES } from "@/lib/app-config";
import type { QrTextPayload } from "@/lib/qr-text-payload";

const QR_SIZE = 220;

const poppins = Poppins({ weight: ["600", "700"], subsets: ["latin"] });
const playfair = Playfair_Display({ weight: ["700", "900"], subsets: ["latin"] });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

/** Fuentes disponibles para título/subtítulo, cada una con una personalidad bien distinta. */
const FONTS = [
  { id: "sans", label: "Sans moderna", className: poppins.className },
  { id: "serif", label: "Serif elegante", className: playfair.className },
  { id: "display", label: "Display / póster", className: bebas.className },
  { id: "mono", label: "Monoespaciada", className: spaceMono.className },
] as const;

type FontId = (typeof FONTS)[number]["id"];

const FONT_OPTIONS: SelectOption[] = FONTS.map((f) => ({ value: f.id, label: f.label }));

const CopyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.34a9.9 9.9 0 0 0 4.62 1.15h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.83 14.03c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.16-4.9-4.35-.14-.19-1.17-1.56-1.17-2.97 0-1.42.74-2.11 1-2.4.26-.29.57-.36.76-.36h.55c.18 0 .42-.03.65.5.24.55.83 1.9.9 2.04.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.13.57.17.29.75 1.24 1.61 2.01 1.11.99 2.05 1.3 2.34 1.44.29.14.46.12.62-.07.17-.19.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.62.77 1.9.91.28.14.46.21.53.33.07.13.07.72-.17 1.4Z" />
  </svg>
);

function classNameFor(id: FontId): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).className;
}

/**
 * Un QR sólo puede llevar una cantidad limitada de datos antes de volverse
 * imposible de escanear. `encodeURIComponent` puede multiplicar hasta ~6x el
 * largo de texto con tildes/ñ, así que medimos el string ya codificado (lo
 * que realmente entra al QR) contra este presupuesto, no los caracteres que
 * escribió la persona.
 */
const QR_DATA_LIMIT = 2800;

const MODE_TABS = [
  { id: "url", label: "Enlace" },
  { id: "texto", label: "Texto" },
] as const;

type QrMode = (typeof MODE_TABS)[number]["id"];

const DOT_STYLES: SelectOption[] = [
  { value: "square", label: "Cuadrado" },
  { value: "dots", label: "Puntos" },
  { value: "rounded", label: "Redondeado" },
  { value: "classy", label: "Elegante" },
  { value: "classy-rounded", label: "Elegante redondeado" },
  { value: "extra-rounded", label: "Extra redondeado" },
];

/**
 * Mini-app pública: genera un QR real (no decorativo) a partir de un enlace,
 * con color/forma de punto configurables, más un título y subtítulo de
 * vista previa en distintas fuentes. Todo client-side, sin persistencia.
 */
export function QrGenerator() {
  const { haptic } = useHaptics();
  const { snack } = useSnackbar();
  const [mode, setMode] = useState<QrMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [titleFont, setTitleFont] = useState<FontId>("display");
  const [subtitleFont, setSubtitleFont] = useState<FontId>("mono");
  const [fgColor, setFgColor] = useState("#150c10");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [dotType, setDotType] = useState<DotType>("rounded");

  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [ready, setReady] = useState(false);

  const trimmedUrl = url.trim();
  const trimmedText = text.trim();
  // `window` no existe durante el render en el servidor; ahí el QR de texto
  // queda vacío hasta que React hidrata en el cliente, donde sí hay origin.
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  /**
   * En modo "Texto" el QR no codifica el texto tal cual: no todos los
   * lectores de QR ofrecen copiar texto plano al escanear, y tampoco hay
   * dónde poner título/subtítulo. En cambio apunta a `QrTextViewer` con un
   * JSON `{ title?, subtitle?, body }`, que esa pantalla desarma y formatea
   * (y siempre garantiza un botón de copiar sólo el `body`).
   */
  const textPayload: QrTextPayload | null =
    mode === "texto" && trimmedText
      ? { title: title.trim() || undefined, subtitle: subtitle.trim() || undefined, body: trimmedText }
      : null;

  const qrData =
    mode === "url"
      ? trimmedUrl
      : textPayload && origin
        ? `${origin}${ROUTES.miniAppGeneradorQrTexto}?d=${encodeURIComponent(JSON.stringify(textPayload))}`
        : "";
  const qrTooLong = qrData.length > QR_DATA_LIMIT;
  const validData = qrData.length > 0 && !qrTooLong;

  const options = useMemo<Partial<QrOptions>>(
    () => ({
      width: QR_SIZE,
      height: QR_SIZE,
      type: "svg",
      data: qrData,
      margin: 8,
      // "L" en modo texto: menos redundancia, más capacidad para textos largos.
      qrOptions: { errorCorrectionLevel: mode === "texto" ? "L" : "M" },
      dotsOptions: { type: dotType, color: fgColor },
      cornersSquareOptions: { type: "extra-rounded", color: fgColor },
      cornersDotOptions: { type: "dot", color: fgColor },
      backgroundOptions: { color: bgColor },
    }),
    [qrData, mode, dotType, fgColor, bgColor]
  );

  useEffect(() => {
    if (!validData || !containerRef.current) return;

    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options);
      containerRef.current.replaceChildren();
      qrRef.current.append(containerRef.current);
    } else {
      qrRef.current.update(options);
    }
    setReady(true);
  }, [options, validData]);

  function download(extension: "png" | "svg") {
    qrRef.current?.download({ name: title.trim() || "qr", extension });
  }

  /** Copia el PNG del QR al portapapeles vía Clipboard API (no soportada en todos los navegadores). */
  async function copyImage() {
    if (!qrRef.current) return;
    haptic("tap");
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("clipboard-image-unsupported");
      }
      const blob = await qrRef.current.getRawData("png");
      if (!(blob instanceof Blob)) throw new Error("no-blob");
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      haptic("success");
      snack({ message: "QR copiado al portapapeles.", variant: "success" });
    } catch {
      snack({
        message: "Este navegador no permite copiar la imagen: descargala en su lugar.",
        variant: "error",
      });
    }
  }

  /**
   * `ShareButton` de la lib sólo comparte título/texto/url (no adjunta
   * archivos), y `wa.me` no soporta adjuntar imágenes por link — así que la
   * única forma de mandar el PNG del QR directo a WhatsApp es la Web Share
   * API con `files`. Si el navegador no la soporta (ej. desktop), bajamos el
   * PNG y abrimos WhatsApp con el texto para que lo adjunten a mano.
   */
  async function shareWhatsApp() {
    if (!qrRef.current) return;
    haptic("tap");
    const shareText =
      [title.trim(), subtitle.trim()].filter(Boolean).join(" — ") || "Mirá este código QR";

    try {
      const blob = await qrRef.current.getRawData("png");
      if (blob instanceof Blob) {
        const file = new File([blob], `${title.trim() || "qr"}.png`, { type: "image/png" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: title.trim() || "Código QR", text: shareText });
          return;
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }

    download("png");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    snack({
      message: "Este navegador no permite enviar la imagen directo: descargamos el QR, adjuntalo en el chat.",
      variant: "info",
    });
  }

  return (
    <div className="space-y-4">
      <Card variant="outline" padding="md" className="space-y-4">
        <TabsGlow items={[...MODE_TABS]} value={mode} onChange={(id: string) => setMode(id as QrMode)} size="sm" />

        {mode === "url" ? (
          <Input
            label="Enlace"
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          />
        ) : (
          <div>
            <Textarea
              label="Texto"
              placeholder="Escribí lo que quieras compartir… puede ser largo."
              value={text}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
              rows={6}
              autoResize
            />
            <p className={`mt-1 text-xs ${qrTooLong ? "text-danger" : "text-muted"}`}>
              {qrData.length} / {QR_DATA_LIMIT} caracteres codificados en el QR
              {qrTooLong && " — texto demasiado largo, acortalo un poco"}
            </p>
          </div>
        )}
        <Input
          label="Título (opcional)"
          value={title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        />
        <Input
          label="Subtítulo (opcional)"
          value={subtitle}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSubtitle(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Fuente del título"
            options={FONT_OPTIONS}
            value={titleFont}
            onChange={(v: string) => setTitleFont(v as FontId)}
          />
          <Select
            label="Fuente del subtítulo"
            options={FONT_OPTIONS}
            value={subtitleFont}
            onChange={(v: string) => setSubtitleFont(v as FontId)}
          />
        </div>

        <Select
          label="Forma del punto"
          options={DOT_STYLES}
          value={dotType}
          onChange={(v: string) => setDotType(v as DotType)}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium mb-2">Color del QR</p>
            <ColorPicker value={fgColor} onChange={setFgColor} />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Fondo</p>
            <ColorPicker value={bgColor} onChange={setBgColor} />
          </div>
        </div>
      </Card>

      <Card variant="outline" padding="lg" className="flex flex-col items-center text-center gap-3">
        {title && (
          <p className={`${classNameFor(titleFont)} text-lg leading-tight`}>{title}</p>
        )}

        {!validData && (
          <p className="text-sm text-muted py-8">
            {qrTooLong
              ? "El texto es demasiado largo para un QR escaneable."
              : mode === "url"
                ? "Pegá un enlace para generar el QR."
                : "Escribí un texto para generar el QR."}
          </p>
        )}
        <div
          ref={containerRef}
          className={validData && ready ? "rounded-xl overflow-hidden" : "hidden"}
          style={{ width: QR_SIZE, height: QR_SIZE, background: bgColor }}
        />

        {subtitle && (
          <p className={`${classNameFor(subtitleFont)} text-sm text-muted`}>{subtitle}</p>
        )}

        {ready && validData && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => download("png")}>
              Descargar PNG
            </Button>
            <Button size="sm" variant="outline" onClick={() => download("svg")}>
              Descargar SVG
            </Button>
            <Button size="sm" variant="outline" leftIcon={<CopyIcon />} onClick={copyImage}>
              Copiar imagen
            </Button>
            <Button
              size="sm"
              className="bg-[#25D366] text-white shadow-md shadow-[#25D366]/25 hover:brightness-110"
              leftIcon={<WhatsAppIcon />}
              onClick={shareWhatsApp}
            >
              Compartir por WhatsApp
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
