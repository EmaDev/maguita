"use client";

import { useRouter } from "next/navigation";
import { OfflineFallback, SafeArea } from "lib-kit-components";
import { ROUTES } from "@/lib/app-config";

export function OfflineScreen() {
  const router = useRouter();

  return (
    <SafeArea edges="all" fillViewport className="grid place-items-center px-5">
      <OfflineFallback
        variant="full"
        title="Sin conexión"
        description="No pudimos cargar esta pantalla. Lo que ya visitaste sigue disponible."
        onRetry={() => router.refresh()}
        onGoCached={() => router.push(ROUTES.miniApps)}
        cachedLabel="Ver mini-apps guardadas"
      />
    </SafeArea>
  );
}
