import type { Metadata } from "next";
import { AuthHeading } from "@/components/molecules/AuthHeading";
import { SignupForm } from "@/components/organisms/auth/SignupForm";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SigninPage() {
  return (
    <>
      <AuthHeading
        title="Creá tu cuenta"
        description="Te lleva menos de un minuto. Después podés instalar la app en tu dispositivo."
      />
      <SignupForm />
    </>
  );
}
