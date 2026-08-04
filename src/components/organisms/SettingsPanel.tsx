"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  InstallButton,
  ProgressBar,
  PwaInstallPrompt,
  PwaStatus,
  Switch,
  formatBytes,
  usePersistentState,
  useStorageEstimate,
  useSnackbar,
} from "lib-kit-components";
import { BellIcon, ChevronRightIcon, LockIcon, LogoutIcon, ShieldIcon } from "@/components/atoms/icons";
import { SectionTitle } from "@/components/molecules/SectionTitle";
import { SettingsRow } from "@/components/molecules/SettingsRow";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { ThemeSegmented } from "@/components/organisms/ThemeToggle";
import { PinSetupForm } from "@/components/organisms/security/PinSetupForm";
import { APP_NAME, APP_VERSION, ROUTES } from "@/lib/app-config";
import type { CurrentUser } from "@/lib/auth/dal";

/** Fila clickeable de una lista de ajustes: mismo padding/hover para toda la pantalla. */
const rowButtonClass =
  "w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-alt active:bg-surface-alt";

export function SettingsPanel({
  user,
  avatarUrl,
  pinSet,
  logoutAction,
  devTools = false,
}: {
  user: CurrentUser;
  avatarUrl: string | null;
  /** Si ya hay un PIN de PinLock configurado en la cuenta. */
  pinSet: boolean;
  /** Server Action de cierre de sesión, pasada desde el Server Component. */
  logoutAction: () => Promise<void>;
  /**
   * `DEV_TOOLS=true` en el server. Baja como prop y no se lee de una variable
   * `NEXT_PUBLIC_`: la flag vive sólo del lado del server (ver `lib/dev-tools.ts`),
   * y esconder el link es cosmético — el gate real es el `notFound()` de la
   * pantalla y el `assertDevTools()` de cada acción.
   */
  devTools?: boolean;
}) {
  const router = useRouter();
  const { snack } = useSnackbar();
  const storage = useStorageEstimate();
  // Contador, no booleano: `PwaInstallPrompt` con `forcePlatform` se cierra con
  // estado interno propio y sólo lo resetea al cambiar `forcePlatform`. Cambiar
  // la `key` lo remonta, así se puede volver a abrir después de cerrarlo.
  const [iosHelpKey, setIosHelpKey] = useState(0);
  /* El permiso de notificaciones ya no se pide desde acá: vive en
     `/ajustes/notificaciones`, junto al alta de la suscripción push y a las
     preferencias por tipo de aviso. Pedirlo suelto en esta pantalla dejaba al
     usuario con el permiso concedido pero sin ninguna suscripción del lado del
     server, o sea sin recibir nada. */
  const [haptics, setHaptics] = usePersistentState("maguita:haptics", true);
  const [reduceData, setReduceData] = usePersistentState("maguita:reduce-data", false);

  return (
    <div className="space-y-8">
      {/* Perfil: identidad de la cuenta y las dos acciones que le pertenecen
          (editarla, cerrar la sesión). Todo lo demás es configuración de la
          app, no de "quién soy" — va en el bloque de abajo. */}
      <section>
        <SectionTitle>Perfil</SectionTitle>
        <Card variant="outline" padding="none" className="divide-y divide-border overflow-hidden">
          <button
            type="button"
            onClick={() => router.push(ROUTES.editarPerfil)}
            className={rowButtonClass}
          >
            <SettingsRow
              leading={
                <UserAvatar
                  initials={user.initials}
                  name={user.name}
                  src={avatarUrl}
                  className="w-11 h-11 text-sm"
                />
              }
              label={user.name}
              description={user.email}
              trailing={<ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />}
            />
          </button>

          {/* form + Server Action: el logout borra la cookie httpOnly en el
              servidor, que es el único lugar donde se puede. */}
          <form action={logoutAction}>
            <button type="submit" className={rowButtonClass}>
              <SettingsRow icon={<LogoutIcon className="h-4 w-4" />} label="Cerrar sesión" tone="danger" />
            </button>
          </form>
        </Card>
      </section>

      <section>
        <SectionTitle>Configuración</SectionTitle>
        <div className="space-y-4">
          <Card variant="outline" padding="none" className="divide-y divide-border overflow-hidden">
            <button
              type="button"
              onClick={() => router.push(ROUTES.notificaciones)}
              className={rowButtonClass}
            >
              <SettingsRow
                icon={<BellIcon className="h-4 w-4" />}
                label="Notificaciones"
                description="Qué te avisamos y por dónde."
                trailing={<ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />}
              />
            </button>

            <div className="space-y-2.5 px-4 py-3.5">
              <p className="text-sm font-medium">Tema</p>
              <ThemeSegmented />
              <p className="text-xs text-muted">
                «Sistema» sigue el tema del dispositivo y cambia solo.
              </p>
            </div>

            <div className="px-4 py-3.5">
              <Switch
                checked={haptics}
                onChange={setHaptics}
                label="Vibración al tocar"
                description="Feedback táctil en botones y gestos."
              />
            </div>
            <div className="px-4 py-3.5">
              <Switch
                checked={reduceData}
                onChange={setReduceData}
                label="Ahorro de datos"
                description="Menos imágenes y sin precarga en conexiones lentas."
              />
            </div>
          </Card>

          <Card variant="outline" padding="md" className="space-y-3">
            <div className="flex items-center gap-2">
              <LockIcon className="h-4 w-4 text-muted" />
              <p className="text-sm font-medium">PIN de la app</p>
            </div>
            <PinSetupForm pinSet={pinSet} />
          </Card>

          <Card variant="outline" padding="md" className="space-y-3">
            <p className="text-sm text-muted leading-relaxed">
              Instalá {APP_NAME} para abrirla a pantalla completa, con ícono propio y
              soporte sin conexión.
            </p>
            <InstallButton
              label={`Instalar ${APP_NAME}`}
              hideWhenUnavailable={false}
              onIosClick={() => setIosHelpKey((n) => n + 1)}
            />
          </Card>
          {/* En iOS no existe prompt nativo: el sheet con los pasos manuales es la
              única vía, y se abre a pedido desde el botón. */}
          {iosHelpKey > 0 && (
            <PwaInstallPrompt key={iosHelpKey} appName={APP_NAME} forcePlatform="ios" />
          )}

          {storage.supported && (
            <Card variant="outline" padding="md" className="space-y-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted">Almacenamiento en este dispositivo</span>
                <span className="font-medium">
                  {formatBytes(storage.usage)} de {formatBytes(storage.quota)}
                </span>
              </div>
              <ProgressBar value={Math.round(storage.ratio * 100)} />
              <div className="flex items-center gap-2 text-xs text-muted">
                <ShieldIcon className="w-4 h-4" />
                {storage.persisted
                  ? "Almacenamiento persistente: el sistema no lo borra por falta de espacio."
                  : "El sistema puede borrar esta caché si necesita espacio."}
              </div>
              <div className="flex gap-2">
                {!storage.persisted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const ok = await storage.requestPersistence();
                      snack({
                        message: ok
                          ? "Almacenamiento persistente activado."
                          : "El navegador no concedió la persistencia.",
                        variant: ok ? "success" : "error",
                      });
                    }}
                  >
                    Hacer persistente
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await storage.clearCaches();
                    await storage.refresh();
                    snack({ message: "Caché liberada.", variant: "success" });
                  }}
                >
                  Liberar caché
                </Button>
              </div>
            </Card>
          )}

          {/* Diagnóstico: info/debug, no un ajuste que se toque seguido — por
              eso va sin `Card` propia, como un pie más liviano del bloque. */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Diagnóstico
            </p>
            {/* observeOnly: el service worker ya lo registra UpdatePrompt desde el
                shell, así que acá sólo lo miramos. */}
            <PwaStatus swUrl="/sw.js" observeOnly title="Estado de la PWA" />
            {devTools && (
              <Button
                variant="outline"
                fullWidth
                className="mt-3"
                onClick={() => router.push(ROUTES.debug)}
              >
                Herramientas de desarrollo
              </Button>
            )}
            <p className="mt-3 text-center text-xs text-muted">
              {APP_NAME} v{APP_VERSION}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
