"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Button,
  ProductFilterBar,
  usePersistentState,
  useSnackbar,
  type ProductFilterGroup,
  type ProductFilterValue,
  type SortField,
} from "lib-kit-components";
import {
  BellIcon,
  CheckIcon,
  ColumnOneIcon,
  ColumnTwoIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/atoms/icons";
import { useAppSheet } from "@/components/shell/app-sheet";
import { PinLockSwitch } from "@/components/molecules/PinLockSwitch";
import { deleteNotesAction } from "@/lib/data/notes-actions";
import type { Note } from "@/lib/data/home";
import { formatDay, formatShortDate, sortNotes } from "@/lib/home-model";
import { NoteComposer } from "./NoteComposer";
import { NoteDetailModal } from "./NoteDetailModal";
import { NOTE_PRIORITY_LABEL, NOTE_PRIORITY_OPTIONS, NOTE_PRIORITY_PAPER } from "./note-priority";

/** Ids de los campos de orden de `ProductFilterBar`. */
const SORT_FIELDS: SortField[] = [
  { id: "fecha", label: "Fecha" },
  { id: "prioridad", label: "Prioridad" },
];

const DEFAULT_FILTERS: ProductFilterValue = { sortField: "fecha", sortDirection: "desc" };

const COLUMN_OPTIONS = [
  { value: 1, label: "Una columna", icon: ColumnOneIcon },
  { value: 2, label: "Dos columnas", icon: ColumnTwoIcon },
];

/**
 * Inclinación del post-it, derivada del id y no del índice: si dependiera de
 * la posición, reordenar la grilla o borrar una nota le cambiaría el ángulo a
 * todas las demás.
 */
function tiltOf(id: string): number {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum += id.charCodeAt(index);
  return sum % 2 === 0 ? -0.8 : 0.8;
}

/**
 * Tab "Notas": el composer (texto, prioridad y alerta) vive siempre visible
 * arriba, no atrás de un botón — es la acción principal de esta tab. Abajo,
 * las notas como post-it (papel según prioridad, apenas torcidos), con una
 * `ProductFilterBar` para ordenar/filtrar y un toggle de una o dos columnas.
 * Cada post-it abre `NoteDetailModal`, o se marca para el borrado masivo si
 * el modo selección está activo.
 */
interface NotesPanelProps {
  today: string;
  notes: Note[];
  /** Contador del FAB de Inicio para enfocar el composer. Ver `NoteComposer`. */
  focusSignal?: number;
  pinSet: boolean;
  locked: boolean;
}

export function NotesPanel({ today, notes, focusSignal, pinSet, locked }: NotesPanelProps) {
  const { snack } = useSnackbar();
  const { openSheet } = useAppSheet();
  const [filters, setFilters] = useState<ProductFilterValue>(DEFAULT_FILTERS);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [deleting, startDelete] = useTransition();
  // Persistida: la densidad de la grilla es una preferencia de lectura, no
  // algo para volver a elegir en cada visita. El hook es SSR-safe.
  const [columns, setColumns] = usePersistentState<number>("maguita:notas-columnas", 2);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Los `count` de cada faceta salen de la lista completa, no de la ya
  // filtrada: si se descontaran solos al tildarlos, el panel de filtros
  // dejaría de servir para saber qué más hay.
  const groups = useMemo<ProductFilterGroup[]>(
    () => [
      {
        id: "prioridad",
        label: "Prioridad",
        options: NOTE_PRIORITY_OPTIONS.map((option) => ({
          id: option.value,
          label: option.label,
          count: notes.filter((note) => note.priority === option.value).length,
        })),
      },
      {
        id: "alerta",
        label: "Alerta",
        multi: false,
        options: [
          { id: "con", label: "Con alerta", count: notes.filter((note) => note.hasAlert).length },
          { id: "sin", label: "Sin alerta", count: notes.filter((note) => !note.hasAlert).length },
        ],
      },
    ],
    [notes]
  );

  // `ProductFilterBar` sólo administra el estado de la barra: filtrar y
  // ordenar la lista real es responsabilidad nuestra (ver su doc).
  const visible = useMemo(() => {
    const priorities = filters.groups?.prioridad ?? [];
    const alert = filters.groups?.alerta ?? [];

    const filtered = notes.filter((note) => {
      if (priorities.length > 0 && !priorities.includes(note.priority)) return false;
      if (alert.includes("con") && !note.hasAlert) return false;
      if (alert.includes("sin") && note.hasAlert) return false;
      return true;
    });

    return sortNotes(
      filtered,
      filters.sortField === "prioridad" ? "priority" : "date",
      filters.sortDirection ?? "desc"
    );
  }, [notes, filters]);

  // Derivada de `notes`, no guardada aparte: si se edita o se borra, el
  // detalle se actualiza (o se cierra solo) apenas `notes` se refresca.
  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  /**
   * Sólo cuentan (y sólo se borran) las seleccionadas que además pasan el
   * filtro actual. Sin esta intersección, tildar tres notas, filtrar por otra
   * prioridad y tocar "Eliminar" borraría notas que no están en pantalla.
   */
  const selectedVisible = useMemo(
    () => visible.filter((note) => selectedIds.has(note.id)),
    [visible, selectedIds]
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelection() {
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirmingBulk(false);
  }

  function removeSelected() {
    const ids = selectedVisible.map((note) => note.id);
    if (ids.length === 0) return;
    startDelete(async () => {
      try {
        await deleteNotesAction(ids);
        snack({
          message: ids.length === 1 ? "Nota eliminada." : `${ids.length} notas eliminadas.`,
          variant: "success",
        });
        exitSelection();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudieron eliminar las notas.",
          variant: "error",
        });
      }
    });
  }

  const openSettingsSheet = () =>
    openSheet(<PinLockSwitch moduleId="notas" locked={locked} pinConfigured={pinSet} />, {
      title: "Ajustes",
      description: "Privacidad de la tab Notas.",
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
          <SettingsIcon />
        </Button>
      </div>

      <NoteComposer today={today} focusSignal={focusSignal} />

      {notes.length > 0 && (
        // El toggle de columnas va afuera de la barra: `ProductFilterBar` no
        // expone ningún slot para sumarle un control propio, y la densidad de
        // la grilla no es un filtro (no cambia qué notas se ven, sólo cómo).
        // `items-start` lo deja anclado a la fila de arriba cuando la barra
        // crece con los chips de filtros activos.
        <div className="flex items-start gap-2">
          <ProductFilterBar
            className="min-w-0 flex-1"
            value={filters}
            onChange={setFilters}
            sortFields={SORT_FIELDS}
            groups={groups}
            resultCount={visible.length}
            resultLabel={(n: number) => `${n} ${n === 1 ? "nota" : "notas"}`}
          />

          <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-border bg-surface">
            {COLUMN_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setColumns(value)}
                aria-pressed={columns === value}
                aria-label={label}
                className={`grid h-9 w-9 place-items-center transition-colors ${
                  columns === value
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-surface-alt hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => (selecting ? exitSelection() : setSelecting(true))}
            aria-pressed={selecting}
            aria-label="Seleccionar notas"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${
              selecting
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:bg-surface-alt hover:text-foreground"
            }`}
          >
            <CheckIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {selecting && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 py-2"
          >
            {confirmingBulk ? (
              <>
                <p className="text-sm font-medium">
                  ¿Eliminar {selectedVisible.length}{" "}
                  {selectedVisible.length === 1 ? "nota" : "notas"}?
                </p>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmingBulk(false)}
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" variant="danger" onClick={removeSelected} loading={deleting}>
                    Eliminar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {selectedVisible.length === 0
                    ? "Tocá las notas que querés borrar"
                    : `${selectedVisible.length} ${
                        selectedVisible.length === 1 ? "seleccionada" : "seleccionadas"
                      }`}
                </p>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSelectedIds(
                        selectedVisible.length === visible.length
                          ? new Set()
                          : new Set(visible.map((note) => note.id))
                      )
                    }
                  >
                    {selectedVisible.length === visible.length ? "Ninguna" : "Todas"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exitSelection}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<TrashIcon className="h-4 w-4" />}
                    disabled={selectedVisible.length === 0}
                    onClick={() => setConfirmingBulk(true)}
                  >
                    Eliminar
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Todavía no hay notas. Escribí la primera arriba.
        </p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Ninguna nota coincide con los filtros.
        </p>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          <AnimatePresence initial={false}>
            {visible.map((note, index) => (
              // Dos capas a propósito: `layout` (reordenar, cambiar de
              // columnas) y `rotate` no conviven en el mismo nodo — framer
              // deforma el contenido al interpolar la posición de algo
              // rotado. El de afuera mueve, el de adentro tuerce.
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                // El escalonado va sólo acá y no en el `transition` de
                // abajo: ese lo comparten `layout` y `exit`, así que un
                // delay por índice haría que reordenar o cambiar de columnas
                // arrastre las últimas notas medio segundo tarde. El tope de
                // 8 evita que con muchas notas la última entre eterna.
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.22, delay: Math.min(index, 8) * 0.03 },
                }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.22 }}
              >
                <motion.button
                  type="button"
                  onClick={() =>
                    selecting ? toggleSelected(note.id) : setSelectedId(note.id)
                  }
                  aria-pressed={selecting ? selectedIds.has(note.id) : undefined}
                  animate={{ rotate: tiltOf(note.id) }}
                  whileHover={{ rotate: 0, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={`relative flex h-full min-h-36 w-full flex-col rounded-sm p-3.5 text-left shadow-lg transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selecting && selectedIds.has(note.id)
                      ? "ring-2 ring-primary"
                      : selecting
                        ? "opacity-70"
                        : ""
                  } ${NOTE_PRIORITY_PAPER[note.priority]}`}
                >
                  {/* En modo selección la tilde reemplaza al "abrir": el
                      papel no cambia de color, sólo se marca. */}
                  {selecting && (
                    <span
                      aria-hidden="true"
                      className={`absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                        selectedIds.has(note.id)
                          ? "border-primary bg-primary text-white"
                          : "border-foreground/30 bg-surface/60 text-transparent"
                      }`}
                    >
                      <CheckIcon className="h-3 w-3" />
                    </span>
                  )}

                  <p
                    className={`line-clamp-5 flex-1 text-sm leading-relaxed text-foreground ${
                      selecting ? "pr-6" : ""
                    }`}
                  >
                    {note.text}
                  </p>

                  {/* Sobre el papel de color no van los chips de
                      `NOTE_PRIORITY_TONE` (pensados para `surface`): acá el
                      contraste lo da `foreground`, que se invierte solo con
                      el tema igual que el papel. */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground/65">
                    <span>{formatDay(note.date, today)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{NOTE_PRIORITY_LABEL[note.priority]}</span>
                    {note.hasAlert && note.alertDate && note.alertTime && (
                      <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-1.5 py-0.5">
                        <BellIcon className="h-3 w-3" />
                        {formatShortDate(note.alertDate)} {note.alertTime}
                      </span>
                    )}
                  </div>

                  {/* Esquina doblada: el detalle que termina de leerlo como
                      papel y no como una card más. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 bg-foreground/10 [clip-path:polygon(100%_0,0_100%,100%_100%)]"
                  />
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <NoteDetailModal note={selectedNote} today={today} onClose={() => setSelectedId(null)} />
    </div>
  );
}
