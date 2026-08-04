import type { Metadata } from "next";
import { ModuleLockGate } from "@/components/organisms/security/ModuleLockGate";
import { SplitGastos } from "@/components/organisms/mini-apps/SplitGastos";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getProfile } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Split de gastos" };

export default async function SplitGastosPage() {
  const session = await requireSession(ROUTES.miniAppSplitGastos);
  const profile = await getProfile(session.sub);
  const pinSet = Boolean(profile?.preferences.pinHash);
  const locked = pinSet && (profile?.preferences.lockedModules.includes("split-gastos") ?? false);

  return (
    <ModuleLockGate moduleId="split-gastos" moduleLabel="Split de gastos" locked={locked}>
      <SplitGastos pinSet={pinSet} locked={locked} />
    </ModuleLockGate>
  );
}
