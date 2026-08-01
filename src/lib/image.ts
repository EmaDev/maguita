/** Sólo se usa desde componentes cliente (usa `Image`/`canvas` del browser). */

const MAX_SIZE = 512;
const JPEG_QUALITY = 0.82;

/**
 * Recorta al cuadrado central y redimensiona a `MAX_SIZE`, devuelve JPEG.
 *
 * El recorte cuadrado es a propósito: el `AvatarPicker` siempre muestra la
 * foto en un círculo, así que cualquier imagen rectangular quedaría con las
 * puntas invisibles igual — mejor decidir el encuadre acá que dejar que el
 * `object-cover` del `<img>` lo haga de forma menos predecible.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await loadImage(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const outSide = Math.min(MAX_SIZE, side);

    const canvas = document.createElement("canvas");
    canvas.width = outSide;
    canvas.height = outSide;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, outSide, outSide);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) throw new Error("No se pudo procesar la imagen.");
    return blob;
  } finally {
    if ("close" in bitmap) bitmap.close();
  }
}

async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}
