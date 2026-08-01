import type { Metadata } from "next";
import { AssistantChat } from "@/components/organisms/AssistantChat";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Asistente" };

export default async function AsistentePage() {
  await requireSession(ROUTES.asistente);
  return <AssistantChat />;
}
