"use client";

import { useEffect, useState } from "react";
import { Button, Spinner, useSnackbar } from "lib-kit-components";
import { DownloadIcon, ImageIcon, WhatsappIcon } from "@/components/atoms/icons";
import type { WorkoutRoutine, WorkoutRoutineDay } from "@/lib/data/workouts";
import {
  canCopyImage,
  canShareFile,
  copyImageToClipboard,
  downloadImage,
  imageFilename,
  openWhatsappWithText,
  shareFile,
} from "@/lib/share-image";
import { renderRoutineDayImage } from "@/lib/workout-day-image";
import { workoutTypeMeta } from "@/lib/workout-model";
import { WEEKDAY_LABELS, routineDayToText } from "./workout-options";

interface WorkoutDayShareSheetProps {
  routine: WorkoutRoutine;
  day: WorkoutRoutineDay;
}

/**
 * Compartir el plan de un día: como imagen al portapapeles, o por la hoja
 * nativa del sistema (que es por donde sale WhatsApp con la imagen adjunta).
 *
 * La imagen se muestra **antes** de mandarla. No es decorativo: la genera un
 * canvas, no es lo que hay en pantalla, así que sin vista previa el usuario
 * copiaría algo que no vio y se enteraría recién al pegarlo en el chat.
 *
 * Se genera una sola vez al abrir y las dos acciones comparten el mismo `Blob`:
 * dibujarla de nuevo por acción tardaría lo mismo dos veces y, peor, metería un
 * `await` largo entre el toque y la llamada al portapapeles — que es justo lo
 * que hace que algunos browsers consideren perdido el gesto del usuario.
 */
export function WorkoutDayShareSheet({ routine, day }: WorkoutDayShareSheetProps) {
  const { snack } = useSnackbar();
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const type = workoutTypeMeta(routine.type);
  const weekday = WEEKDAY_LABELS[day.weekday] ?? "";
  const text = routineDayToText(routine, day);
  const filename = imageFilename(routine.name, weekday);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    renderRoutineDayImage({
      routineName: routine.name,
      typeLabel: `${type.emoji} ${type.label}`,
      weekdayLabel: weekday,
      dayTitle: day.title,
      exercises: day.exercises.map((exercise) => ({
        name: exercise.name,
        detail: exercise.detail,
      })),
    }).then(
      (blob) => {
        // El sheet se puede cerrar mientras se dibuja: sin este corte se
        // setearía estado de un componente ya desmontado y quedaría una object
        // URL sin revocar.
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage(blob);
        setPreviewUrl(url);
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [routine.name, type.emoji, type.label, weekday, day.title, day.exercises]);

  async function copy() {
    if (!image) return;
    setBusy(true);
    const outcome = await copyImageToClipboard(image);
    setBusy(false);

    if (outcome === "ok") {
      snack({ message: "Imagen copiada. Pegala en el chat.", variant: "success" });
      return;
    }
    /* Firefox no escribe imágenes en el portapapeles (está detrás de un flag),
       así que en vez de un error se ofrece el camino que sí funciona. */
    downloadImage(image, filename);
    snack({
      message:
        outcome === "unsupported"
          ? "Tu navegador no copia imágenes: la descargamos."
          : "No se pudo copiar: la descargamos.",
      variant: "info",
    });
  }

  async function share() {
    if (!image) return;
    const file = new File([image], filename, { type: image.type });

    if (!canShareFile(file)) {
      /* Desktop: no hay hoja nativa con archivos y `wa.me` sólo acepta texto,
         así que se manda el plan escrito y la imagen queda para copiar. */
      openWhatsappWithText(text);
      return;
    }

    setBusy(true);
    const outcome = await shareFile(file, text);
    setBusy(false);

    // `cancelled` es el usuario cerrando la hoja: no es un error.
    if (outcome === "error") {
      snack({ message: "No se pudo abrir el menú de compartir.", variant: "error" });
    }
  }

  if (failed) {
    return (
      <div className="space-y-3 py-1">
        <p className="text-sm text-muted">
          No se pudo generar la imagen. Podés compartir el plan como texto.
        </p>
        <Button fullWidth variant="outline" onClick={() => openWhatsappWithText(text)}>
          <WhatsappIcon className="h-4 w-4" />
          Enviar como texto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-1">
      {/* La vista previa scrollea: un día cargado da una imagen alta y angosta,
          y encogerla entera para que entre la dejaría ilegible. */}
      <div className="max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface-alt">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- es un blob del canvas, no un asset: `next/image` no puede optimizar una object URL.
          <img src={previewUrl} alt={`Plan de ${weekday}: ${day.title}`} className="w-full" />
        ) : (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button fullWidth disabled={!image || busy} onClick={share}>
          <WhatsappIcon className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button fullWidth variant="outline" disabled={!image || busy} onClick={copy}>
          <ImageIcon className="h-4 w-4" />
          Copiar imagen
        </Button>
      </div>

      {/* Siempre visible y no sólo como fallback: guardarla es un destino
          válido por sí mismo (mandarla por otra app, imprimirla, archivarla). */}
      <Button
        fullWidth
        size="sm"
        variant="ghost"
        disabled={!image}
        onClick={() => image && downloadImage(image, filename)}
      >
        <DownloadIcon className="h-4 w-4" />
        Descargar la imagen
      </Button>

      {!canCopyImage() && (
        <p className="text-xs leading-relaxed text-muted">
          Tu navegador no permite copiar imágenes al portapapeles; “Copiar imagen” la va a
          descargar.
        </p>
      )}
    </div>
  );
}
