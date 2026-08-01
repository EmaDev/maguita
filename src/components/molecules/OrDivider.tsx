/** Separador "o" entre el formulario y las alternativas de ingreso (ej. Google). */
export function OrDivider({ label = "o" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted" role="separator">
      <div className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
