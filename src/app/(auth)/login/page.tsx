import type { Metadata } from "next";
import { AuthHeading } from "@/components/molecules/AuthHeading";
import { LoginForm } from "@/components/organisms/auth/LoginForm";
import { ROUTES } from "@/lib/app-config";
import { safeNext } from "@/lib/auth/validation";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage(props: PageProps<"/login">) {
  // En Next.js 16 `searchParams` es asíncrono: el acceso sincrónico se removió.
  const params = await props.searchParams;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <>
      <AuthHeading
        title="Hola de nuevo"
        description="Ingresá para ver tus favoritos, tu asistente y tus mini-apps."
      />
      <LoginForm
        next={safeNext(nextParam, ROUTES.inicio)}
        justReset={params.reset === "1"}
      />
    </>
  );
}
