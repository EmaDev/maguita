import type { Metadata } from "next";
import { SplitGastos } from "@/components/organisms/mini-apps/SplitGastos";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Split de gastos" };

export default async function SplitGastosPage() {
  await requireSession(ROUTES.miniAppSplitGastos);
  return <SplitGastos />;
}
