"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Button,
  DatePicker,
  Popover,
  Switch,
  Textarea,
  TimePicker,
  usePersistentState,
  useSnackbar,
  type DateRange,
} from "lib-kit-components";
import { ChevronDownIcon, FlagIcon } from "@/components/atoms/icons";
import { addNoteAction } from "@/lib/data/notes-actions";
import type { NotePriority } from "@/lib/data/home";
import { alertInstant, dayKey, parseDay } from "@/lib/home-model";
import {
  NOTE_PRIORITY_LABEL,
  NOTE_PRIORITY_OPTIONS,
  NOTE_PRIORITY_PAPER,
  TIME_PICKER_UPWARD,
} from "./note-priority";

const DEFAULT_ALERT_TIME = "09:00";

/**
 * Trigger del `Popover` de prioridad: el click lo maneja el popover. El
 * fondo es el mismo papel (`NOTE_PRIORITY_PAPER`) que va a tener la card
 * resultante, para que elegir prioridad sea elegir color a simple vista.
 */
function Chip({ icon, label, paper }: { icon: ReactNode; label: string; paper: string }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded-full border border-foreground/10 px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors ${paper}`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Composer de la tab Notas: colapsado por defecto, es un acordeón (header +
 * `AnimatePresence` de altura) en vez de un sheet aparte — cargar una nota
 * sigue siendo la acción principal, pero abrir el form ya no le saca lugar a
 * la lista todo el tiempo. El estado abierto/cerrado se persiste
 * (`usePersistentState`) igual que la densidad de columnas: es una
 * preferencia de la pantalla, no algo para decidir en cada visita. Adentro,
 * texto grande arriba y, debajo, dos chips en vez de un form apilado — mismo
 * espíritu que los chips "Add Tag / Add Category / Reminder" de referencia
 * que pidió el dueño del producto. El de prioridad abre un `Popover` con las
 * tres opciones; al lado va el `Switch` de alerta, que al prenderse
 * despliega fecha y hora acá abajo. Sin selector de fecha de la nota: `date`
 * es siempre el día de hoy, no un campo que el usuario elija.
 */
interface NoteComposerProps {
  today: string;
  /**
   * Contador que crece cada vez que el FAB de Inicio pide una nota nueva.
   * Al cambiar, el composer se despliega (si estaba cerrado), se enfoca y se
   * trae a la vista — sin esto, tocar "Nueva nota" desde otra tab dejaba al
   * usuario en Notas sin ninguna señal de dónde escribir.
   */
  focusSignal?: number;
  /**
   * Acción extra en el header del acordeón (el botón de ajustes de la tab).
   * Vive acá y no en una fila propia arriba del composer: esa fila quedaba
   * vacía salvo por el ícono, dejando un espacio muerto sobre la card.
   */
  headerAction?: ReactNode;
}

export function NoteComposer({ today, focusSignal, headerAction }: NoteComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<NotePriority>("medium");
  const [hasAlert, setHasAlert] = useState(false);
  const [alertDate, setAlertDate] = useState<Date | null>(null);
  const [alertTime, setAlertTime] = useState(DEFAULT_ALERT_TIME);

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [open, setOpen] = usePersistentState<boolean>("maguita:notas-composer-abierto", true);

  /**
   * El `overflow-hidden` del acordeón sólo hace falta *mientras* anima la
   * altura (0 → auto): una vez asentado, sacarlo es necesario para que el
   * `Popover` de prioridad no quede recortado — no usa portal, así que
   * cualquier ancestro con `overflow: hidden` le corta el panel (ver
   * `Popover.md`). Dejarlo prendido para siempre (como estaba) recortaba el
   * panel por la izquierda y además rompía el orden de apilado con el botón
   * de guardar, que terminaba pintándose encima.
   *
   * Arranca en `open`, no en `false`: `AnimatePresence initial={false}` hace
   * que el composer, si ya carga abierto (el default persistido), no corra
   * ninguna animación de entrada — y sin animación, `onAnimationComplete`
   * nunca dispara, así que sin este arranque el recorte quedaría prendido
   * para siempre en el caso más común.
   */
  const [bodySettled, setBodySettled] = useState(open);

  function toggleOpen(next: boolean) {
    setOpen(next);
    // Se re-arma tanto al abrir como al cerrar: los dos animan la altura
    // (0 → auto al abrir, auto → 0 en el `exit` al cerrar) y necesitan el
    // mismo recorte mientras dura la transición.
    setBodySettled(false);
  }

  const value = text.trim();
  const valid = !!value && (!hasAlert || (!!alertDate && !!alertTime));

  // El FAB de Inicio sólo marca que hay que enfocar el composer; el acordeón
  // recién termina de abrirse en el render siguiente, así que el foco espera
  // a que `open` se vuelva verdadero antes de correr.
  const pendingFocusRef = useRef(false);

  // `focusSignal` arranca en `undefined`/0 y sólo crece al tocar el FAB, así
  // que el composer no se despliega ni se roba el foco al montarse la
  // pantalla.
  useEffect(() => {
    if (!focusSignal) return;
    pendingFocusRef.current = true;
    setOpen(true);
  }, [focusSignal, setOpen]);

  useEffect(() => {
    if (!open || !pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const frame = requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

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
        /* El instante absoluto se calcula acá y no en el server: es la hora
           local de este dispositivo, y el server no conoce su huso (ver
           `alertInstant`). Sin esto el cron dispararía el recordatorio corrido
           tantas horas como diferencia haya con el reloj del server. */
        const alertDay = hasAlert && alertDate ? dayKey(alertDate) : null;
        await addNoteAction({
          text: value,
          date: today,
          priority,
          hasAlert,
          alertDate: alertDay,
          alertTime: hasAlert ? alertTime : null,
          alertAtMs: alertDay ? alertInstant(alertDay, alertTime) : null,
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
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex w-full items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => toggleOpen(!open)}
          aria-expanded={open}
          className="flex flex-1 items-center justify-between gap-2 py-1 text-left"
        >
          <span className="text-sm font-medium text-foreground">Nueva nota</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18 }}
            className="text-muted"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </motion.span>
        </button>
        {headerAction}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="composer-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={() => setBodySettled(true)}
            className={bodySettled ? "" : "overflow-hidden"}
          >
            <div className="space-y-3 px-4 pb-4">
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
                  align="start"
                  trigger={
                    <Chip
                      icon={<FlagIcon className="h-4 w-4" />}
                      label={NOTE_PRIORITY_LABEL[priority]}
                      paper={NOTE_PRIORITY_PAPER[priority]}
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
                        className={`rounded-lg border px-3 py-1.5 text-left text-sm font-medium text-foreground/80 transition-colors ${
                          NOTE_PRIORITY_PAPER[option.value]
                        } ${
                          option.value === priority
                            ? "border-primary ring-1 ring-primary"
                            : "border-transparent hover:brightness-95"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
