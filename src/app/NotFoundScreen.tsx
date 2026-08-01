"use client";

import { useRouter } from "next/navigation";
import { PageStatusScreen, SafeArea } from "lib-kit-components";
import { ROUTES } from "@/lib/app-config";

export function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeArea edges="all" fillViewport className="grid place-items-center px-5">
      <PageStatusScreen
        status="404"
        title="No encontramos esta pantalla"
        description="Puede que el link esté viejo o que la mini-app haya cambiado de nombre."
        primary={{ label: "Ir a Mini-apps", onClick: () => router.push(ROUTES.miniApps) }}
        secondary={{ label: "Volver", onClick: () => router.back() }}
      />
    </SafeArea>
  );
}
