import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditProfileForm } from "@/components/organisms/EditProfileForm";
import { ROUTES } from "@/lib/app-config";
import { initialsFrom, requireSession } from "@/lib/auth/dal";
import { getProfile } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function EditarPerfilPage() {
  const session = await requireSession(ROUTES.editarPerfil);
  const profile = await getProfile(session.sub);
  // No debería pasar (Auth y el perfil se crean juntos, ver `getProfile`),
  // pero si pasara no hay nada que editar.
  if (!profile) redirect(ROUTES.ajustes);

  return (
    <EditProfileForm
      profile={profile}
      initials={initialsFrom(profile.name, profile.email)}
    />
  );
}
