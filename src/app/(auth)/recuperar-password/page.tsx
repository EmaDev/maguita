import type { Metadata } from "next";
import { AuthHeading } from "@/components/molecules/AuthHeading";
import { PasswordRecoveryForm } from "@/components/organisms/auth/PasswordRecoveryForm";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Recuperar contraseña"
        description="Te enviamos un código de 6 dígitos para verificar que sos vos."
      />
      <PasswordRecoveryForm />
    </>
  );
}
