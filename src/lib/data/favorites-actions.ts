"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { toggleFavorite } from "./favorites";

/**
 * Agrega o quita un favorito. Vuelve a verificar la sesión: una Server Action es
 * un endpoint público, así que no puede confiar en que la pantalla que la llamó
 * ya estaba protegida.
 */
export async function toggleFavoriteAction(miniAppId: string): Promise<void> {
  const session = await requireSession(ROUTES.favoritos);
  await toggleFavorite(session.sub, miniAppId);
  revalidatePath(ROUTES.favoritos);
  revalidatePath(ROUTES.miniApps);
}
