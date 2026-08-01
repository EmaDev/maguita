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
  useNotificationPermission,
  usePersistentState,
  useStorageEstimate,
  useSnackbar,
} from "lib-kit-components";
import { ShieldIcon } from "@/components/atoms/icons";
import { SectionTitle } from "@/components/molecules/SectionTitle";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { ThemeSegmented } from "@/components/organisms/ThemeToggle";
import { APP_NAME, APP_VERSION, ROUTES } from "@/lib/app-config";
import type { CurrentUser } from "@/lib/auth/dal";

export function SettingsPanel({
  user,
  avatarUrl,
  logoutAction,
}: {
  user: CurrentUser;
  avatarUrl: string | null;
  /** Server Action de cierre de sesión, pasada desde el Server Component. */
  logoutAction: () => Promise<void>;
}) {
  const router = useRouter();
  const { snack } = useSnackbar();
  const notifications = useNotificationPermission();
  const storage = useStorageEstimate();
  // Contador, no booleano: `PwaInstallPrompt` con `forcePlatform` se cierra con
  // estado interno propio y sólo lo resetea al cambiar `forcePlatform`. Cambiar
  // la `key` lo remonta, así se puede volver a abrir después de cerrarlo.
  const [iosHelpKey, setIosHelpKey] = useState(0);
  const [haptics, setHaptics] = usePersistentState("maguita:haptics", true);
  const [reduceData, setReduceData] = usePersistentState("maguita:reduce-data", false);

  async function toggleNotifications(next: boolean) {
    if (!next) {
      // El navegador no permite revocar un permiso desde la página.
      snack({
        message: "Quitá el permiso desde los ajustes del navegador.",
        variant: "info",
      });
      return;
    }
    const status = await notifications.request();
    snack({
      message:
        status === "granted"
          ? "Listo, vas a recibir notificaciones."
          : "No se concedió el permiso de notificaciones.",
      variant: status === "granted" ? "success" : "error",
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Cuenta</SectionTitle>
        <Card variant="outline" padding="md">
          <div className="flex items-center gap-3.5">
            {/* Sin `name`: el nombre ya está escrito al lado, repetirlo en el
                aria-label sólo duplicaría la lectura. */}
            <UserAvatar initials={user.initials} src={avatarUrl} className="w-12 h-12" />
            <div className="min-w-0">
              <p className="font-medium truncate">{user.name}</p>
              <p className="text-sm text-muted truncate">{user.email}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => router.push(ROUTES.editarPerfil)}
            >
              Editar perfil
            </Button>

            {/* form + Server Action: el logout borra la cookie httpOnly en el
                servidor, que es el único lugar donde se puede. */}
            <form action={logoutAction}>
              <Button type="submit" variant="outline" fullWidth>
                Cerrar sesión
              </Button>
            </form>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Apariencia</SectionTitle>
        <ThemeSegmented />
        <p className="mt-2 text-xs text-muted">
          «Sistema» sigue el tema del dispositivo y cambia solo.
        </p>
      </section>

      <section>
        <SectionTitle>Instalación</SectionTitle>
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
          <PwaInstallPrompt
            key={iosHelpKey}
            appName={APP_NAME}
            forcePlatform="ios"
          />
        )}
      </section>

      <section>
        <SectionTitle>Preferencias</SectionTitle>
        <Card variant="outline" padding="md" className="space-y-4">
          <Switch
            checked={notifications.status === "granted"}
            onChange={toggleNotifications}
            disabled={notifications.status === "unsupported"}
            label="Notificaciones"
            description={
              notifications.status === "unsupported"
                ? "Este navegador no las soporta."
                : notifications.status === "denied"
                  ? "Bloqueadas: habilitalas desde el navegador."
                  : "Avisos de resúmenes y recordatorios."
            }
          />
          <Switch
            checked={haptics}
            onChange={setHaptics}
            label="Vibración al tocar"
            description="Feedback táctil en botones y gestos."
          />
          <Switch
            checked={reduceData}
            onChange={setReduceData}
            label="Ahorro de datos"
            description="Menos imágenes y sin precarga en conexiones lentas."
          />
        </Card>
      </section>

      {storage.supported && (
        <section>
          <SectionTitle>Almacenamiento</SectionTitle>
          <Card variant="outline" padding="md" className="space-y-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">En este dispositivo</span>
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
        </section>
      )}

      <section>
        <SectionTitle>Diagnóstico</SectionTitle>
        {/* observeOnly: el service worker ya lo registra UpdatePrompt desde el
            shell, así que acá sólo lo miramos. */}
        <PwaStatus swUrl="/sw.js" observeOnly title="Estado de la PWA" />
        <p className="mt-3 text-center text-xs text-muted">
          {APP_NAME} v{APP_VERSION}
        </p>
      </section>
    </div>
  );
}
