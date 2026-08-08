"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Button, ChipCarousel, Input, Select, Textarea, useSnackbar } from "lib-kit-components";
import {
  addCustomExerciseAction,
  updateCustomExerciseAction,
} from "@/lib/data/exercises-actions";
import {
  DEFAULT_EQUIPMENT,
  DEFAULT_MUSCLE_GROUP,
  EQUIPMENT_LABELS,
  MUSCLE_GROUPS,
  type ExerciseEquipment,
  type ExerciseInfo,
  type MuscleGroup,
} from "@/lib/exercise-catalog";

/** Mismos topes que `exercises-actions.ts`: el server igual los valida. */
const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_TIPS = 8;

const GROUP_CHIPS = MUSCLE_GROUPS.map((group) => ({
  id: group.id,
  label: `${group.emoji} ${group.label}`,
}));

const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

interface ExerciseComposerProps {
  /** Ejercicio propio a editar. Ausente = alta de uno nuevo. */
  exercise?: ExerciseInfo;
  /** Lo llama el sheet al guardar bien. Recibe el id, para poder seleccionarlo apenas se crea. */
  onSaved: (exerciseId: string) => void;
}

/**
 * ABM de un ejercicio propio. Sólo aplica a los del usuario: el catálogo base
 * es estático y no se edita desde la app (ver `lib/exercise-catalog.ts`).
 *
 * Los consejos se cargan como texto libre, **uno por línea**, en vez de con
 * filas de inputs como los pasos de un hábito: acá cada consejo es una frase
 * larga y el usuario suele pegarlos de algún lado, así que un textarea es más
 * rápido de completar que N inputs. El split lo hace este componente y el
 * server descarta las líneas vacías.
 */
export function ExerciseComposer({ exercise, onSaved }: ExerciseComposerProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(exercise?.name ?? "");
  const [group, setGroup] = useState<MuscleGroup>(exercise?.group ?? DEFAULT_MUSCLE_GROUP);
  const [equipment, setEquipment] = useState<ExerciseEquipment>(
    exercise?.equipment ?? DEFAULT_EQUIPMENT
  );
  const [description, setDescription] = useState(exercise?.description ?? "");
  const [tips, setTips] = useState((exercise?.tips ?? []).join("\n"));

  const valid = !!name.trim();

  function save() {
    if (!valid) return;
    startTransition(async () => {
      try {
        const fields = {
          name: name.trim(),
          group,
          equipment,
          description: description.trim() || null,
          tips: tips.split("\n").slice(0, MAX_TIPS),
        };
        if (exercise) {
          await updateCustomExerciseAction({ id: exercise.id, ...fields });
          snack({ message: "Ejercicio actualizado.", variant: "success" });
          onSaved(exercise.id);
        } else {
          const id = await addCustomExerciseAction(fields);
          snack({ message: "Ejercicio creado.", variant: "success" });
          onSaved(id);
        }
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el ejercicio.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5 py-1">
      <Input
        label="Nombre"
        placeholder="Ej. Remo invertido en anillas"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Grupo muscular
        </p>
        <ChipCarousel
          chips={GROUP_CHIPS}
          value={group}
          size="sm"
          clearable={false}
          onChange={(next: string | string[]) => {
            if (!Array.isArray(next)) setGroup(next as MuscleGroup);
          }}
        />
      </div>

      <Select
        label="Equipamiento"
        options={EQUIPMENT_OPTIONS}
        value={equipment}
        disabled={pending}
        onChange={(next: string) => setEquipment(next as ExerciseEquipment)}
      />

      <Textarea
        label="Descripción (opcional)"
        placeholder="Qué es y para qué sirve."
        value={description}
        rows={3}
        maxLength={MAX_DESCRIPTION_LENGTH}
        disabled={pending}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
      />

      <Textarea
        label="Consejos de ejecución (uno por línea)"
        placeholder={"Mantené la espalda neutra.\nBajá controlado."}
        value={tips}
        rows={5}
        disabled={pending}
        hint={`Hasta ${MAX_TIPS} consejos.`}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTips(e.target.value)}
      />

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        {exercise ? "Guardar cambios" : "Crear ejercicio"}
      </Button>
    </div>
  );
}
