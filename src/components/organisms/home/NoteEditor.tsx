"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DatePicker,
  Select,
  Switch,
  Textarea,
  TimePicker,
  useSnackbar,
  type DateRange,
} from "lib-kit-components";
import { updateNoteAction } from "@/lib/data/notes-actions";
import type { Note, NotePriority } from "@/lib/data/home";
import { dayKey, parseDay } from "@/lib/home-model";
import { NOTE_PRIORITY_OPTIONS, TIME_PICKER_UPWARD } from "./note-priority";

const DEFAULT_ALERT_TIME = "09:00";

/**
 * Edición de una nota ya creada, dentro de `NoteDetailModal`. Mismos campos
 * que `NoteComposer` (sin selector de fecha: `date` no es editable, queda
 * como el día en que se creó la nota), en un form apilado en vez de chips —
 * acá hay espacio de sobra (pantalla completa). Mismo criterio que
 * `ExpenseCycleForm`/`ExpenseCycleEditor`: cada uno con su propio estado
 * local, sin compartir un hook.
 */
interface NoteEditorProps {
  note: Note;
  onSaved: () => void;
}

export function NoteEditor({ note, onSaved }: NoteEditorProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(note.text);
  const [priority, setPriority] = useState<NotePriority>(note.priority);
  const [hasAlert, setHasAlert] = useState(note.hasAlert);
  const [alertDate, setAlertDate] = useState<Date | null>(
    note.alertDate ? parseDay(note.alertDate) : null
  );
  const [alertTime, setAlertTime] = useState(note.alertTime ?? DEFAULT_ALERT_TIME);

  const value = text.trim();
  const valid = !!value && (!hasAlert || (!!alertDate && !!alertTime));

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        await updateNoteAction({
          id: note.id,
          text: value,
          date: note.date,
          priority,
          hasAlert,
          alertDate: hasAlert && alertDate ? dayKey(alertDate) : null,
          alertTime: hasAlert ? alertTime : null,
        });
        snack({ message: "Nota actualizada.", variant: "success" });
        onSaved();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar la nota.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        label="Nota"
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        rows={6}
        maxLength={500}
        showCount
        autoResize
        disabled={pending}
      />
      <Select
        label="Prioridad"
        value={priority}
        onChange={(value: string) => setPriority(value as NotePriority)}
        options={NOTE_PRIORITY_OPTIONS}
      />
      <Switch
        checked={hasAlert}
        onChange={setHasAlert}
        label="Es una alerta"
        description="Programá fecha y hora para que te la recuerde."
      />
      {hasAlert && (
        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            mode="single"
            label="Fecha de la alerta"
            value={alertDate}
            onChange={(value: Date | DateRange | null) => setAlertDate(value as Date | null)}
          />
          <TimePicker
            label="Hora"
            value={alertTime}
            onChange={(value: string | null) => setAlertTime(value ?? DEFAULT_ALERT_TIME)}
            step={5}
            className={TIME_PICKER_UPWARD}
          />
        </div>
      )}
      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        Guardar cambios
      </Button>
    </div>
  );
}
