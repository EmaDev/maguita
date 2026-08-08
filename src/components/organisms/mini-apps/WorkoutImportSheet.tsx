"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Button, Textarea, useSnackbar } from "lib-kit-components";
import { importRoutinesAction } from "@/lib/data/workouts-actions";
import { IMPORT_EXAMPLE } from "./workout-options";

interface WorkoutImportSheetProps {
  /** Lo llama el sheet al importar bien, para cerrarse. */
  onImported: () => void;
}

/**
 * Importación de rutinas desde JSON. El parseo y la validación viven enteros
 * en `importRoutinesAction` (el cliente no puede ser la última palabra sobre
 * lo que entra a Firestore), así que acá sólo se manda el texto y se muestra
 * el error que devuelva — que ya viene con el campo y la rutina que falló.
 *
 * El ejemplo no es decorativo: es la documentación del formato, y el botón lo
 * pega en el textarea para poder editarlo en el momento en vez de tener que
 * escribirlo de memoria.
 */
export function WorkoutImportSheet({ onImported }: WorkoutImportSheetProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [json, setJson] = useState("");

  function importRoutines() {
    if (!json.trim()) return;
    startTransition(async () => {
      try {
        const count = await importRoutinesAction(json);
        snack({
          message: count === 1 ? "Rutina importada." : `${count} rutinas importadas.`,
          variant: "success",
        });
        onImported();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo importar el JSON.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4 py-1">
      <p className="text-sm leading-relaxed text-muted">
        Pegá el JSON de una rutina (o un array con varias). El día acepta el número de
        <code className="mx-1 rounded bg-surface-alt px-1 py-0.5 text-xs">weekday</code>
        (0 = domingo) o el nombre (&ldquo;lunes&rdquo;), y los ejercicios pueden ser objetos o
        texto suelto.
      </p>

      <Textarea
        label="JSON"
        placeholder='{ "name": "Mi rutina", "type": "gimnasio", "days": [...] }'
        value={json}
        rows={8}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJson(e.target.value)}
      />

      <details className="rounded-2xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Ver un ejemplo</summary>
        <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-surface-alt p-3 text-[11px] leading-relaxed">
          {IMPORT_EXAMPLE}
        </pre>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={pending}
          onClick={() => setJson(IMPORT_EXAMPLE)}
        >
          Usar este ejemplo
        </Button>
      </details>

      <Button fullWidth onClick={importRoutines} disabled={!json.trim() || pending} loading={pending}>
        Importar
      </Button>
    </div>
  );
}
