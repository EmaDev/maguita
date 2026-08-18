/** Sólo se usa desde componentes cliente (usa `navigator`/`document` del browser). */

/**
 * Compartir una imagen generada: al portapapeles, o por la hoja nativa del
 * sistema (que es por donde aparece WhatsApp).
 *
 * `ShareButton` de la librería no sirve para esto: sus props extienden
 * `ShareData` con `title`/`text`/`url` y no aceptan `files`, así que puede
 * compartir un link pero no una imagen. `useClipboard` es texto solo por la
 * misma razón (`copy: (text: string)`).
 *
 * Las tres APIs de acá tienen soporte desparejo y **todas** exigen un gesto del
 * usuario, así que cada función devuelve qué pasó en vez de tirar: la UI tiene
 * que poder ofrecer el camino alternativo, no un cartel de error.
 */

/** Qué terminó pasando. `unsupported` = el browser no puede; `cancelled` = el usuario cerró la hoja de compartir. */
export type ShareOutcome = "ok" | "unsupported" | "cancelled" | "error";

/**
 * `true` si el browser puede escribir imágenes en el portapapeles.
 *
 * `navigator.clipboard.write` con un `image/png` funciona en Chrome/Edge y en
 * Safari moderno, pero **no** en Firefox (está detrás de un flag). No alcanza
 * con chequear `navigator.clipboard`: existe también donde sólo hay `writeText`,
 * y en contexto no seguro no existe nada.
 */
export function canCopyImage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.ClipboardItem === "function" &&
    typeof navigator.clipboard?.write === "function"
  );
}

/**
 * `true` si el browser puede compartir archivos por la hoja nativa (Web Share
 * Level 2). Es lo que hace falta para que aparezca WhatsApp con la imagen
 * adjunta: el link `wa.me` sólo acepta texto, no archivos.
 *
 * Se pregunta con `canShare({ files })` y no con `"share" in navigator`, porque
 * hay browsers que tienen `share` para texto/URL y rechazan archivos.
 */
export function canShareFile(file: File): boolean {
  return typeof navigator !== "undefined" && (navigator.canShare?.({ files: [file] }) ?? false);
}

/** Copia la imagen al portapapeles. */
export async function copyImageToClipboard(blob: Blob): Promise<ShareOutcome> {
  if (!canCopyImage()) return "unsupported";
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return "ok";
  } catch {
    /* Puede fallar por permiso denegado o porque se perdió el gesto del usuario
       (el `await` de generar la imagen cuenta como demora en algunos browsers).
       En los dos casos la UI ofrece descargar, así que no distingue. */
    return "error";
  }
}

/**
 * Abre la hoja nativa de compartir con la imagen adjunta.
 *
 * `AbortError` es el usuario cerrando la hoja sin elegir nada: eso **no** es un
 * error, y mostrarle un cartel rojo por cancelar sería tratarlo como uno.
 */
export async function shareFile(file: File, text: string): Promise<ShareOutcome> {
  if (!canShareFile(file)) return "unsupported";
  try {
    await navigator.share({ files: [file], text });
    return "ok";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "error";
  }
}

/**
 * Abre WhatsApp con un texto ya cargado. Es el camino de último recurso: sirve
 * en desktop, donde no hay hoja nativa con archivos, pero manda el plan como
 * texto — la imagen se queda afuera.
 *
 * `wa.me` sin número abre el selector de contacto, que es lo que se quiere: la
 * app no sabe (ni tiene por qué) a quién le va a mandar el plan.
 */
export function openWhatsappWithText(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

/**
 * Descarga la imagen como archivo. Es la salida cuando el portapapeles no
 * acepta imágenes (Firefox), para que la función nunca quede sin ningún camino.
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  /* En el próximo macrotask y no acá mismo: revocar la URL en el mismo tick que
     el `click()` la deja sin fuente en algunos browsers antes de que arranque la
     descarga. Sin revocarla nunca, el blob queda en memoria hasta recargar. */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Nombre de archivo seguro a partir de un texto libre (nombre de rutina + día). */
export function imageFilename(...parts: string[]): string {
  const slug = parts
    .join("-")
    .toLowerCase()
    // `NFD` separa cada letra acentuada en la letra base más su diacrítico, y
    // `\p{Diacritic}` borra justo esos: así "Miércoles" queda "miercoles" en vez
    // de perder la vocal entera.
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "rutina"}.png`;
}
