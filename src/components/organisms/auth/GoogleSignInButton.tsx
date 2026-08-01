"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Button } from "lib-kit-components";
import { GoogleIcon } from "@/components/atoms/icons";
import { firebaseAuth } from "@/lib/firebase/client";
import { loginWithGoogle } from "@/lib/auth/actions";

/**
 * El popup y el intercambio de token corren en el cliente porque necesitan el
 * `window` del browser (`signInWithPopup`); apenas Firebase devuelve el ID
 * token, `loginWithGoogle` (Server Action) hace lo mismo que el login por
 * contraseña: crea el perfil si hace falta y canjea el token por la session
 * cookie. Si ese paso termina bien, la action redirige — este componente sólo
 * necesita mostrar el error si algo falla antes.
 */
export function GoogleSignInButton({
  next,
  onError,
}: {
  next?: string;
  onError: (message: string | null) => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    onError(null);
    setPending(true);
    try {
      const credential = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      const result = await loginWithGoogle(idToken, next);
      if (result?.message) onError(result.message);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // El usuario cerró el popup o disparó dos: no es un error que mostrar.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        onError("No pudimos ingresar con Google. Probá de nuevo.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      size="lg"
      loading={pending}
      onClick={handleClick}
      leftIcon={<GoogleIcon />}
    >
      Continuar con Google
    </Button>
  );
}
