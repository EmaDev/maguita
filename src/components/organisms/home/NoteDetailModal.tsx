"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Dropdown, useSnackbar, type DropdownItem } from "lib-kit-components";
import { BellIcon, MoreIcon, PencilIcon, TrashIcon } from "@/components/atoms/icons";
import { deleteNoteAction } from "@/lib/data/notes-actions";
import type { Note } from "@/lib/data/home";
import { formatDay, formatShortDate } from "@/lib/home-model";
import { NOTE_PRIORITY_LABEL, NOTE_PRIORITY_PAPER } from "./note-priority";
import { NoteEditor } from "./NoteEditor";

interface NoteDetailModalProps {
  /**
   * `null` = cerrado. Viene derivada de la lista (`notes.find(...)`) en vez de
   * guardarse aparte: así, si `notes` se refresca después de guardar un
   * cambio, el detalle muestra el texto nuevo sin recibir ningún prop extra, y
   * si la nota se borra desaparece de la lista y el detalle se cierra solo.
   */
  note: Note | null;
  today: string;
  onClose: () => void;
}

/** Las tres caras del detalle. Una sola a la vez, con transición entre ellas. */
type Mode = "view" | "edit" | "confirm";

/**
 * Detalle de una nota: el mismo post-it de la grilla pero grande, centrado y
 * sobre un backdrop. No usa el `Modal` de la librería — ese trae su propia
 * superficie (`surface`, header y footer con bordes) y no hay forma de que se
 * lea como papel. El overlay se arma acá con el mismo patrón que
 * `shell/notification-drawer.tsx` (backdrop `z-[140]` + panel `z-[150]`,
 * bloqueo de scroll, foco al abrir y cierre con Escape), que es lo que ya se
 * usa en la app cuando la librería no tiene el contenedor que hace falta.
 *
 * Editar y borrar viven en un menú de tres puntitos en vez de una botonera:
 * el papel se mantiene limpio y las dos acciones sólo aparecen cuando se las
 * busca. Borrar pide confirmación en el mismo panel, sin apilar otro encima.
 */
export function NoteDetailModal({ note, today, onClose }: NoteDetailModalProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("view");
  const panelRef = useRef<HTMLDivElement>(null);

  const noteId = note?.id ?? null;

  /**
   * Cerrar siempre vuelve el panel a "view". Se hace acá y no en un efecto
   * sobre `note` (que sería un `setState` en efecto, con su cascada de
   * renders): todos los caminos que cierran el detalle pasan por esta
   * función, y con el backdrop puesto no se puede abrir otra nota sin cerrar
   * la actual primero.
   */
  const close = useCallback(() => {
    setMode("view");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!noteId) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    // Sin esto el fondo scrollea detrás del panel en iOS (mismo bloqueo que
    // hace `BottomSheet`).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // El foco entra al panel para que el lector de pantalla y el tabulador no
    // sigan recorriendo la pantalla de atrás.
    panelRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [noteId, close]);

  function remove() {
    if (!note) return;
    startTransition(async () => {
      try {
        await deleteNoteAction(note.id);
        snack({ message: "Nota eliminada.", variant: "success" });
        close();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar la nota.",
          variant: "error",
        });
      }
    });
  }

  const menuItems: DropdownItem[] = [
    {
      label: "Editar",
      icon: <PencilIcon className="h-4 w-4" />,
      onClick: () => setMode("edit"),
    },
    // `label` es obligatorio en `DropdownItem` aunque el separador lo ignore.
    { label: "", divider: true },
    {
      label: "Eliminar",
      icon: <TrashIcon className="h-4 w-4" />,
      destructive: true,
      onClick: () => setMode("confirm"),
    },
  ];

  return (
    <AnimatePresence>
      {note && (
        <>
          <motion.div
            className="fixed inset-0 z-[140] bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-hidden="true"
          />

          {/* El contenedor no captura toques (`pointer-events-none`) para que
              clickear al costado del papel llegue al backdrop y cierre; sólo
              el panel los recibe. */}
          <div className="pointer-events-none fixed inset-0 z-[150] grid place-items-center p-4">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Nota"
              tabIndex={-1}
              // Entra como un papel que se apoya: baja, se agranda y se
              // endereza; sale girando apenas para el otro lado.
              initial={{ opacity: 0, scale: 0.92, y: 24, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16, rotate: 1.5 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={`pointer-events-auto relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-sm p-5 shadow-2xl outline-none ${NOTE_PRIORITY_PAPER[note.priority]}`}
            >
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                  {mode === "edit" ? "Editando" : "Nota"}
                </p>

                {/* El menú vive afuera del área scrolleable de abajo: si
                    estuviera adentro, el `overflow-y-auto` le recortaría el
                    desplegable. */}
                {mode === "view" && (
                  <Dropdown
                    trigger={
                      <button
                        type="button"
                        aria-label="Acciones de la nota"
                        className="grid h-8 w-8 place-items-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      >
                        <MoreIcon className="h-4 w-4" />
                      </button>
                    }
                    items={menuItems}
                  />
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                  {mode === "edit" ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-3"
                    >
                      <NoteEditor note={note} onSaved={close} />
                      <Button variant="ghost" fullWidth onClick={() => setMode("view")}>
                        Cancelar
                      </Button>
                    </motion.div>
                  ) : mode === "confirm" ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <p className="text-base font-medium text-foreground">
                        ¿Eliminar esta nota?
                      </p>
                      <p className="line-clamp-3 text-sm text-foreground/65">{note.text}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() => setMode("view")}
                          disabled={pending}
                        >
                          Cancelar
                        </Button>
                        <Button variant="danger" fullWidth onClick={remove} loading={pending}>
                          Eliminar
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                    >
                      <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                        {note.text}
                      </p>

                      {/* Mismos tonos que el post-it de la grilla: sobre papel
                          de color, `foreground` con opacidad en vez de los
                          chips de `NOTE_PRIORITY_TONE`, que están pensados
                          para `surface`. */}
                      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/65">
                        <span>{formatDay(note.date, today)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{NOTE_PRIORITY_LABEL[note.priority]}</span>
                        {note.hasAlert && note.alertDate && note.alertTime && (
                          <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5">
                            <BellIcon className="h-3.5 w-3.5" />
                            {formatShortDate(note.alertDate)} {note.alertTime}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* La misma esquina doblada que la card de la grilla. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 bg-foreground/10 [clip-path:polygon(100%_0,0_100%,100%_100%)]"
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
