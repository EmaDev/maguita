/**
 * Avatar del usuario: la foto de perfil si `src` viene con valor, o las
 * iniciales sobre el degradado de marca — el mismo que usa `BrandMark`, así
 * la cabecera y los ajustes se ven de la misma familia cuando no hay foto.
 */
export function UserAvatar({
  initials,
  name,
  src,
  className = "w-9 h-9 text-sm",
}: {
  initials: string;
  /** Sólo para el `title`/`aria-label`; el texto visible son las iniciales. */
  name?: string;
  /** URL de la foto de perfil (`avatarUrl`). `null`/`undefined` muestra iniciales. */
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        aria-hidden={name ? undefined : true}
        title={name}
        className={`shrink-0 rounded-full object-cover bg-surface ${className}`}
      />
    );
  }

  return (
    <span
      // aria-hidden cuando no hay nombre: en ese caso las iniciales no aportan
      // nada al lector de pantalla, sólo ruido.
      aria-hidden={name ? undefined : true}
      aria-label={name}
      title={name}
      className={`grid place-items-center shrink-0 rounded-full bg-gradient-to-br from-primary to-accent text-white font-semibold ${className}`}
    >
      {initials}
    </span>
  );
}
