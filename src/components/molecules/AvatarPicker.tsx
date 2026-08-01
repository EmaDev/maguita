"use client";

import { useRef, useState } from "react";
import { CameraIcon } from "@/components/atoms/icons";
import { compressImage } from "@/lib/image";
import { UserAvatar } from "./UserAvatar";

/**
 * Selector de foto de perfil para el form de "Editar perfil". No es de
 * `lib-kit-components`: la lib trae uno igual pero como pieza interna de
 * `ProfileEditor`, sin exportar por separado (ver `docs/components/ProfileEditor.md`
 * de la lib), así que se rearma acá con el mismo patrón (botón circular,
 * overlay de cámara al hover, input de archivo oculto).
 *
 * El `<input type="file">` es el que efectivamente viaja en el `FormData` del
 * `<form>` que lo contiene — por eso necesita `name`, y por eso la foto se
 * comprime *antes* de asignarla a `input.files` (vía `DataTransfer`) en vez de
 * mandarla al padre como estado aparte: así el resto del form (nombre, alias)
 * sigue siendo un `<form action={formAction}>` normal, sin lógica extra de
 * submit para el archivo.
 */
export function AvatarPicker({
  name,
  initials,
  initialUrl,
  error,
}: {
  name: string;
  initials: string;
  initialUrl: string | null;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setPickError(null);
    if (!file.type.startsWith("image/")) {
      setPickError("El archivo tiene que ser una imagen.");
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], "avatar.jpg", {
        type: "image/jpeg",
      });

      // Reemplaza el `FileList` del input por uno con el archivo ya
      // comprimido — así el `FormData` del submit manda la versión liviana,
      // no el original que eligió el usuario.
      const transfer = new DataTransfer();
      transfer.items.add(compressedFile);
      if (inputRef.current) inputRef.current.files = transfer.files;

      setPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressedFile);
      });
    } catch {
      setPickError("No se pudo procesar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  const shownError = error ?? pickError ?? undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Cambiar foto de perfil"
          className="group relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-surface"
        >
          <UserAvatar
            initials={initials}
            src={preview}
            className="w-20 h-20 text-xl"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
            <CameraIcon className="w-[18px] h-[18px] text-white" />
          </span>
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/45">
              <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
      {shownError && <span className="text-xs text-danger">{shownError}</span>}
    </div>
  );
}
