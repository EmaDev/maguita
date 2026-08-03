"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Button,
  DatePicker,
  Popover,
  Switch,
  Textarea,
  TimePicker,
  useSnackbar,
  type DateRange,
} from "lib-kit-components";
import { FlagIcon } from "@/components/atoms/icons";
import { addNoteAction } from "@/lib/data/notes-actions";
import type { NotePriority } from "@/lib/data/home";
import { dayKey, parseDay } from "@/lib/home-model";
import {
  NOTE_PRIORITY_LABEL,
  NOTE_PRIORITY_OPTIONS,
  NOTE_PRIORITY_TONE,
  TIME_PICKER_UPWARD,
} from "./note-priority";

const DEFAULT_ALERT_TIME = "09:00";

/** Trigger del `Popover` de prioridad: el click lo maneja el popover. */
function Chip({ icon, label, tone }: { icon: ReactNode; label: string; tone: string }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${tone}`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Composer siempre visible arriba de la tab Notas — no un sheet aparte:
 * cargar una nota es la acción principal de esta tab. Texto grande arriba y,
 * debajo, dos chips en vez de un form apilado — mismo espíritu que los chips
 * "Add Tag / Add Category / Reminder" de referencia que pidió el dueño del
 * producto. El de prioridad abre un `Popover` con las tres opciones; al lado
 * va el `Switch` de alerta, que al prenderse despliega fecha y hora acá
 * abajo. Sin selector de fecha de la nota: `date` es siempre el día de hoy,
 * no un campo que el usuario elija.
 */
interface NoteComposerProps {
  today: string;
  /**
   * Contador que crece cada vez que el FAB de Inicio pide una nota nueva.
   * Al cambiar, el composer se enfoca y se trae a la vista — sin esto, tocar
   * "Nueva nota" desde otra tab dejaba al usuario en Notas sin ninguna señal
   * de dónde escribir.
   */
  focusSignal?: number;
}

export function NoteComposer({ today, focusSignal }: NoteComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<NotePriority>("medium");
  const [hasAlert, setHasAlert] = useState(false);
  const [alertDate, setAlertDate] = useState<Date | null>(null);
  const [alertTime, setAlertTime] = useState(DEFAULT_ALERT_TIME);

  const [priorityOpen, setPriorityOpen] = useState(false);

  const value = text.trim();
  const valid = !!value && (!hasAlert || (!!alertDate && !!alertTime));

  // `focusSignal` arranca en `undefined`/0 y sólo crece al tocar el FAB, así
  // que el composer no se roba el foco al montarse la pantalla.
  useEffect(() => {
    if (!focusSignal) return;
    textRef.current?.focus();
    textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusSignal]);

  /**
   * Al prender la alerta se preselecciona hoy: si quedara vacía, el toggle
   * dejaría el formulario inválido sin que se vea por qué (el botón de
   * guardar se apaga y la fecha recién aparece más abajo).
   */
  function toggleAlert(next: boolean) {
    setHasAlert(next);
    if (next && !alertDate) setAlertDate(parseDay(today));
  }

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        await addNoteAction({
          text: value,
          date: today,
          priority,
          hasAlert,
          alertDate: hasAlert && alertDate ? dayKey(alertDate) : null,
          alertTime: hasAlert ? alertTime : null,
        });
        setText("");
        setPriority("medium");
        setHasAlert(false);
        setAlertDate(null);
        setAlertTime(DEFAULT_ALERT_TIME);
        snack({ message: "Nota guardada.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar la nota.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <Textarea
        ref={textRef}
        placeholder="Escribí tu nota..."
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        rows={4}
        maxLength={500}
        showCount
        autoResize
        disabled={pending}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Popover
          open={priorityOpen}
          onOpenChange={setPriorityOpen}
          trigger={
            <Chip
              icon={<FlagIcon className="h-4 w-4" />}
              label={NOTE_PRIORITY_LABEL[priority]}
              tone={NOTE_PRIORITY_TONE[priority]}
            />
          }
        >
          <div className="flex w-36 flex-col gap-1">
            {NOTE_PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPriority(option.value);
                  setPriorityOpen(false);
                }}
                className={`rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors ${
                  option.value === priority
                    ? NOTE_PRIORITY_TONE[option.value]
                    : "text-foreground hover:bg-surface-alt"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Popover>

        <Switch checked={hasAlert} onChange={toggleAlert} label="Alerta" size="sm" />
      </div>

      {hasAlert && (
        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            mode="single"
            label="Fecha"
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
        Guardar nota
      </Button>
    </div>
  );
}
