import { Skeleton } from "lib-kit-components";

/**
 * Fallback automático de Next mientras `InicioPage` resuelve `getHomeData()`
 * (primer load o navegación a /inicio) — sin esto, esa espera se ve como una
 * pantalla en blanco y parece que la app se colgó.
 *
 * La forma sigue a la card del gestor de gastos (`MovementsPanel`) porque es
 * la tab más pesada de las cuatro, pero al no saber todavía qué tab quedó
 * activa (esa decisión es del cliente, ver `AppFrame`), es genérica a
 * propósito: card con progreso + una lista corta, algo que se parece
 * razonablemente a cualquiera de las cuatro.
 */
export default function InicioLoading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
      <div className="space-y-4 rounded-2xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton variant="text" width={90} height={11} />
            <Skeleton variant="text" width={140} height={28} />
            <Skeleton variant="text" width={100} height={12} />
          </div>
          <Skeleton variant="rounded" width={72} height={32} />
        </div>
        <Skeleton variant="rounded" height={8} />
        <div className="flex gap-2 pt-1">
          <Skeleton variant="rounded" height={36} className="flex-1" />
          <Skeleton variant="rounded" height={36} className="flex-1" />
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
          >
            <Skeleton variant="circle" width={36} height={36} />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" width="50%" height={13} />
              <Skeleton variant="text" width="30%" height={11} />
            </div>
            <Skeleton variant="text" width={60} height={13} />
          </div>
        ))}
      </div>
    </div>
  );
}
