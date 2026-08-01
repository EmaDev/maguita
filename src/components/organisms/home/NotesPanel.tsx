"use client";

import { Button, Card, PageStatusScreen } from "lib-kit-components";
import { NoteIcon, PlusIcon } from "@/components/atoms/icons";
import type { Note } from "@/lib/data/home";
import { formatDay } from "@/lib/home-model";

/**
 * Tab "Notas": las notas más recientes primero. Las que se cargaron desde el
 * FAB todavía no tienen backend, así que se marcan como guardadas en este
 * dispositivo en vez de mostrarlas como si estuvieran sincronizadas.
 */
interface NotesPanelProps {
  today: string;
  notes: Note[];
  onAdd: () => void;
}

export function NotesPanel({ today, notes, onAdd }: NotesPanelProps) {
  if (notes.length === 0) {
    return (
      <PageStatusScreen
        status="empty"
        title="Todavía no hay notas"
        description="Anotá lo que no querés que se te escape: la lista queda acá."
        primary={{ label: "Escribir una nota", onClick: onAdd }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<PlusIcon className="h-4 w-4" />}
        onClick={onAdd}
      >
        Nueva nota
      </Button>

      <ul className="space-y-2.5">
        {notes.map((note) => (
          <li key={note.id}>
            <Card variant="glass" padding="sm">
              <div className="flex gap-3">
                <span
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent"
                  aria-hidden="true"
                >
                  <NoteIcon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">{note.text}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                    {formatDay(note.date, today)}
                    {note.local && (
                      <span className="rounded-full bg-surface-alt px-2 py-0.5">
                        En este dispositivo
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
