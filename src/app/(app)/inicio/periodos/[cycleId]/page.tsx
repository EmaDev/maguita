import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PeriodDetailScreen } from "@/components/organisms/home/PeriodDetailScreen";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getExpenseCycleById, getExpenseMovements } from "@/lib/data/expenses";

export const metadata: Metadata = { title: "Período anterior" };

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const session = await requireSession(ROUTES.inicio);

  // `null` cubre tanto "no existe" como "es de otra cuenta" (ver
  // `getExpenseCycleById`) — cualquiera de los dos casos es un 404, no un
  // error distinto que delate cuál de las dos pasó.
  const cycle = await getExpenseCycleById(session.sub, cycleId);
  if (!cycle) notFound();

  const movements = await getExpenseMovements(cycleId);

  return <PeriodDetailScreen cycle={cycle} movements={movements} />;
}
