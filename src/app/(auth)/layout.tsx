import type { ReactNode } from "react";
import { AuthShell } from "./AuthShell";

/** Server Component: sólo delega en el shell cliente, así las pantallas de
 *  auth siguen pudiendo exportar `metadata`. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
