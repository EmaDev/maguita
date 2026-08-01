import type { Metadata } from "next";
import { HomeBoard } from "@/components/organisms/HomeBoard";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getHomeData } from "@/lib/data/home";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const session = await requireSession(ROUTES.inicio);
  const data = await getHomeData(session.sub);

  return <HomeBoard data={data} />;
}
