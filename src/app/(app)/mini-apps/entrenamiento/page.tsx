import type { Metadata } from "next";
import { ModuleLockGate } from "@/components/organisms/security/ModuleLockGate";
import { WorkoutTrainer } from "@/components/organisms/mini-apps/WorkoutTrainer";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getCustomExercises } from "@/lib/data/exercises";
import { getProfile } from "@/lib/data/profile";
import { getWorkoutRoutines, getWorkoutSessions } from "@/lib/data/workouts";
import { dayKey } from "@/lib/home-model";

export const metadata: Metadata = { title: "Entrenamiento" };

export default async function EntrenamientoPage() {
  const session = await requireSession(ROUTES.miniAppEntrenamiento);
  const [routines, sessions, customExercises, profile] = await Promise.all([
    getWorkoutRoutines(session.sub),
    getWorkoutSessions(session.sub),
    getCustomExercises(session.sub),
    getProfile(session.sub),
  ]);
  const pinSet = Boolean(profile?.preferences.pinHash);
  const locked = pinSet && (profile?.preferences.lockedModules.includes("entrenamiento") ?? false);

  return (
    <ModuleLockGate moduleId="entrenamiento" moduleLabel="Entrenamiento" locked={locked}>
      <WorkoutTrainer
        // El día lo resuelve el server y baja como prop, igual que en Inicio:
        // que el cliente no lo recalcule evita que el HTML del server y el
        // primer render del browser difieran cuando están en husos distintos.
        today={dayKey(new Date())}
        routines={routines}
        sessions={sessions}
        customExercises={customExercises}
        pinSet={pinSet}
        locked={locked}
      />
    </ModuleLockGate>
  );
}
