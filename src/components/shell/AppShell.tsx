"use client";

import {
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppHeader,
  BottomNav,
  NativeShell,
  OfflineBanner,
  PwaInstallPrompt,
  SafeArea,
  SnackbarProvider,
  SplashScreen,
  Tabs,
  UpdatePrompt,
  greetingFor,
  useSnackbar,
  useSplash,
  useStatusBarColor,
  type AppNotification,
  type HeaderAction,
} from "lib-kit-components";
import {
  BellIcon,
  BrandMark,
  MoonIcon,
  SunIcon,
} from "@/components/atoms/icons";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { useTheme } from "@/components/theme/ThemeProvider";
import { APP_NAME, APP_TAGLINE, APP_VERSION, ROUTES, SW_URL } from "@/lib/app-config";
import type { CurrentUser } from "@/lib/auth/dal";
import {
  clearNotificationsAction,
  dismissNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/data/notifications-actions";
import { AppSheetProvider } from "./app-sheet";
import { AUTHED_NAV, GUEST_NAV, headerFor } from "./nav-config";
import { NotificationDrawer } from "./notification-drawer";
import { NotificationSync } from "./notification-sync";
import { ShellSearchProvider } from "./shell-search";
import { ShellTabsProvider } from "./shell-tabs";

interface AppShellProps {
  children: ReactNode;
  /** Con sesión mostramos los 5 tabs; sin sesión, sólo lo público. */
  authed: boolean;
  /** Para el saludo y el avatar de la cabecera. Ausente en la sección pública. */
  user?: CurrentUser;
  /** Foto de perfil (`avatarUrl`) para el avatar de la cabecera. `null`/ausente muestra iniciales. */
  avatarUrl?: string | null;
  notifications?: AppNotification[];
}

/* El saludo no cambia por ningún evento: nos suscribimos a nada. Definido a
   nivel de módulo para que la referencia sea estable entre renders. */
const noSubscribe = () => () => {};

/** Lo que el usuario puede hacerle a la bandeja desde el panel. */
type InboxAction =
  | { type: "read"; id: string }
  | { type: "read-all" }
  | { type: "dismiss"; id: string }
  | { type: "clear" };

function reduceInbox(items: AppNotification[], action: InboxAction): AppNotification[] {
  switch (action.type) {
    case "read":
      return items.map((n) => (n.id === action.id ? { ...n, read: true } : n));
    case "read-all":
      return items.map((n) => ({ ...n, read: true }));
    case "dismiss":
      return items.filter((n) => n.id !== action.id);
    case "clear":
      return [];
  }
}

interface NotificationInbox {
  items: AppNotification[];
  read: (id: string) => void;
  readAll: () => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

/**
 * La bandeja del panel: lo que llega del layout (Server Component) más el
 * cambio que el usuario acaba de hacer, aplicado antes de que el servidor
 * conteste.
 *
 * Va con `useOptimistic` y no con `useState`: leer o descartar tiene que verse
 * al instante (el usuario ya tocó la fila), pero la lista real la sigue
 * mandando el servidor en cada revalidación — con `useState` habría dos copias
 * y la del cliente pisaría a la del servidor, así que una notificación nueva
 * emitida en otra pestaña no aparecería nunca. Acá el estado optimista dura lo
 * que dura la Server Action y después vuelve a mandar el prop.
 *
 * Si la acción falla, el `catch` no revierte nada a mano: alcanza con que
 * termine la transición para que el prop del servidor —que no cambió— vuelva a
 * ser lo que se ve.
 */
function useNotificationInbox(initial: AppNotification[]): NotificationInbox {
  const { snack } = useSnackbar();
  const [, startTransition] = useTransition();
  const [items, applyOptimistic] = useOptimistic(initial, reduceInbox);

  const run = useCallback(
    (action: InboxAction, persist: () => Promise<void>) => {
      startTransition(async () => {
        applyOptimistic(action);
        try {
          await persist();
        } catch {
          snack({ message: "No pudimos guardar el cambio.", variant: "error" });
        }
      });
    },
    [applyOptimistic, snack]
  );

  return useMemo(
    () => ({
      items,
      read: (id) => run({ type: "read", id }, () => markNotificationReadAction(id)),
      readAll: () => run({ type: "read-all" }, markAllNotificationsReadAction),
      dismiss: (id) => run({ type: "dismiss", id }, () => dismissNotificationAction(id)),
      clear: () => run({ type: "clear" }, clearNotificationsAction),
    }),
    [items, run]
  );
}

/**
 * Saludo según la hora ("Buen día", "Buenas tardes", "Buenas noches").
 *
 * `greetingFor()` mira la hora del dispositivo, así que el server y el cliente
 * pueden no coincidir (otra zona horaria, u otro momento del día si la respuesta
 * quedó cacheada). `useSyncExternalStore` es justamente el hook para eso: el
 * server y la hidratación renderizan "Hola" y el cliente pasa al saludo real en
 * el render siguiente, sin desajuste de hidratación.
 */
function useGreeting(): string {
  return useSyncExternalStore(noSubscribe, greetingFor, () => "Hola");
}

/**
 * Shell de la app, compuesto pieza por pieza con los componentes de la
 * librería en vez de `PackageApp`. Sigue el orden de montaje de la guía "La
 * base de una app (PWA)" (`docs/guides/app-base.md`), que es el que define
 * quién tapa a quién:
 *
 *   SnackbarProvider                ← provider: cualquier pantalla usa useSnackbar()
 *   └── NativeShell                 ← publica --sa-*, --app-height
 *       ├── SplashScreen            ← z-200, tapa todo mientras carga
 *       ├── OfflineBanner           ← z-130
 *       ├── PwaInstallPrompt        ← z-120
 *       ├── UpdatePrompt            ← z-125
 *       ├── SafeArea (fillViewport, edges left/right)
 *       │   ├── AppHeader           ← resuelve el inset de arriba
 *       │   └── <main>              ← acá entran las pantallas
 *       │       └── FabActionSheets ← sólo lo monta `HomeBoard`, no el shell
 *       └── BottomNav               ← z-40, md:hidden
 *
 * El árbol explícito (en vez de `PackageApp`) es lo que permite decidir acá qué
 * se monta y con qué props: la campana de notificaciones interactiva o el
 * `AppHeader` único resuelto por ruta.
 */
export function AppShell({
  children,
  authed,
  user,
  avatarUrl,
  notifications = [],
}: AppShellProps) {
  const navItems = authed ? AUTHED_NAV : GUEST_NAV;

  return (
    // El provider va por fuera de NativeShell para que su portal de snacks no
    // dependa del contenedor. gap alto: 64px de BottomNav + margen.
    <SnackbarProvider position="bottom-center" gap={80}>
      {/* onlyWhenInstalled: los bloqueos de zoom sólo aplican con la PWA
          instalada, así el zoom del navegador queda intacto (WCAG 1.4.4). */}
      <NativeShell onlyWhenInstalled>
        <AppSheetProvider>
          <AppFrame
            authed={authed}
            user={user}
            avatarUrl={avatarUrl}
            navItems={navItems}
            notifications={notifications}
          >
            {children}
          </AppFrame>
        </AppSheetProvider>
      </NativeShell>
    </SnackbarProvider>
  );
}

/**
 * Vive por dentro de los providers para poder usar sus hooks y para que el
 * estado que comparte con las pantallas (buscador, tab activa, notificaciones)
 * sobreviva a los cambios de ruta.
 */
function AppFrame({
  children,
  authed,
  user,
  avatarUrl,
  navItems,
  notifications: initialNotifications,
}: {
  children: ReactNode;
  authed: boolean;
  user?: CurrentUser;
  avatarUrl?: string | null;
  navItems: typeof AUTHED_NAV;
  notifications: AppNotification[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const greeting = useGreeting();

  const splash = useSplash({
    minDuration: 1100,
    waitForFonts: true,
    oncePerSession: true,
  });

  // El buscador vive en el shell, que no se desmonta al cambiar de tab. Guardamos
  // la ruta junto al término y lo consideramos vacío en cualquier otra: así se
  // resetea al navegar sin un efecto que dispare un render extra.
  const [search, setSearch] = useState({ path: pathname, query: "" });
  const query = search.path === pathname ? search.query : "";
  const setQuery = useCallback(
    (next: string) => setSearch({ path: pathname, query: next }),
    [pathname]
  );

  const screen = headerFor(pathname);

  // Pantallas con `welcome`: el título pasa a ser el saludo con el nombre y el
  // avatar va en el slot `leading`. Con `largeTitle` el saludo se ve grande
  // arriba y, al scrollear, colapsa a la línea del avatar sin cambiar de texto.
  const welcome = screen.welcome && user ? user : undefined;
  const firstName = welcome?.name.trim().split(/\s+/)[0] ?? "";

  // Misma técnica que el buscador: la tab activa se guarda junto a la ruta, así
  // al navegar vuelve sola a la primera sin un efecto de reset.
  const [tabState, setTabState] = useState({ path: pathname, tab: "" });
  const firstTab = screen.tabs?.[0]?.id ?? "";
  const tab =
    tabState.path === pathname && tabState.tab ? tabState.tab : firstTab;
  const setTab = useCallback(
    (next: string) => setTabState({ path: pathname, tab: next }),
    [pathname]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const notifications = useNotificationInbox(initialNotifications);
  const unread = notifications.items.filter((n) => !n.read).length;

  // Tiñe la barra de estado del sistema para que acompañe al tema activo.
  useStatusBarColor({ light: "#ffffff", dark: "#150c10" });

  const isDark = resolvedTheme === "dark";

  const actions = useMemo<HeaderAction[]>(() => {
    const list: HeaderAction[] = [
      {
        id: "theme",
        label: isDark ? "Activar tema claro" : "Activar tema oscuro",
        icon: isDark ? <MoonIcon /> : <SunIcon />,
        onClick: () => setTheme(isDark ? "light" : "dark"),
      },
    ];
    if (authed) {
      list.push({
        id: "notifications",
        label: "Notificaciones",
        icon: <BellIcon />,
        badge: unread > 0 ? unread : undefined,
        onClick: () => setDrawerOpen(true),
      });
    }
    return list;
  }, [authed, isDark, setTheme, unread]);

  return (
    // Los providers no renderizan DOM, así que van por fuera del div que la
    // hoja de estilos usa como ancla.
    // El data-attribute lo usa globals.css para levantar los banners PWA
    // (instalación y actualización) por encima del BottomNav: son los únicos
    // que no exponen su offset inferior como prop.
    <ShellTabsProvider value={{ tab, setTab }}>
      <div data-app-shell="with-nav" className="contents">
        <ShellSearchProvider value={{ query, setQuery }}>
          <SplashScreen
            visible={splash.visible}
            progress={splash.progress}
            appName={APP_NAME}
            tagline={APP_TAGLINE}
            version={APP_VERSION}
            variant="zoom"
            background="brand"
            icon={<BrandMark className="w-20 h-20" />}
          />
  
          <OfflineBanner position="top" />
  
          <PwaInstallPrompt
            appName={APP_NAME}
            tagline="Instalá Maguita para abrirla como app y usarla sin conexión."
            snoozeDays={21}
            icon={<BrandMark className="w-full h-full" />}
          />
  
          {/* Registra el service worker y avisa cuando hay una versión nueva
              esperando. `SW_URL` lleva `?v=APP_VERSION`, así que subir la versión
              en `app-config` alcanza para que el navegador vea otro worker, lo
              instale, lo deje en `waiting` y este aviso salga solo — sin tocar
              nada adentro de `public/sw.js`.

              El aviso lo dispara la primera carga que trae el bundle nuevo (las
              navegaciones son network-first: el HTML nuevo llega aunque el
              worker viejo siga controlando la pestaña). Una pestaña que quede
              abierta desde antes del deploy no se entera hasta que navegue: el
              chequeo periódico del hook re-pide la URL vieja, que no cambió. */}
          <UpdatePrompt
            swUrl={SW_URL}
            title="Hay una versión nueva"
            description={`Actualizá para pasar a la versión ${APP_VERSION} y tener los últimos cambios.`}
            actionLabel="Actualizar"
          />
  
          {/* AppHeader resuelve el inset de arriba y BottomNav el de abajo, así que
              acá sólo quedan los laterales (relevantes en landscape con notch).
              fillViewport usa --app-height: la altura real del viewport, sin el
              salto de 100vh cuando aparece/desaparece la barra del navegador. */}
          <SafeArea
            edges={["left", "right"]}
            fillViewport
            className="flex flex-col bg-surface text-foreground"
          >
            <AppHeader
              title={welcome ? `${greeting}, ${firstName}` : screen.title}
              subtitle={welcome ? APP_TAGLINE : screen.subtitle}
              onBack={screen.back ? () => router.back() : undefined}
              leading={
                welcome ? (
                  // Los márgenes son el aire alrededor del avatar: el wrapper
                  // del slot `leading` trae `pl-1.5 pr-0.5` y la fila un `gap-1`,
                  // que lo dejan pegado al borde y al título. Lleva a Ajustes:
                  // es el mismo lugar desde donde se edita el perfil.
                  <Link href={ROUTES.ajustes} aria-label="Ir a ajustes">
                    {/* mt-1.5: la fila del header queda centrada por flex, así
                        que este margen es lo que separa al avatar del borde
                        superior en vez de quedar pegado. */}
                    <UserAvatar
                      initials={welcome.initials}
                      name={welcome.name}
                      src={avatarUrl}
                      className="w-10 h-10 text-sm ml-1 mr-1.5 mt-1.5"
                    />
                  </Link>
                ) : undefined
              }
              largeTitle={screen.largeTitle}
              centerTitle={screen.centerTitle}
              searchable={screen.searchable}
              searchPlaceholder={screen.searchPlaceholder}
              variant="blur"
              // pb en el root: la fila de tabs del header termina en `pb-1.5` y
              // queda pegada al contenido. No se puede sumar `pt` acá — el
              // AppHeader fija el padding superior por `style` (la safe area) y
              // el inline gana sobre la clase.
              className="pb-2"
              actions={actions}
              // Al cancelar la búsqueda el header llama con "", que limpia el
              // filtro de la pantalla sin lógica extra.
              onSearch={screen.searchable ? setQuery : undefined}
            >
              {/* `children` del AppHeader es la fila extra debajo del título: acá
                  van las tabs de la pantalla. La pantalla las lee con
                  `useShellTabs()` en vez de montar su propio bloque de tabs.
                  `scrollable` es lo que hace que 7 tabs entren igual que 3. */}
              {screen.tabs && (
                // pt propio: el slot de `children` sólo trae `px-2 pb-1.5`, así
                // que sin esto las tabs quedan contra el título de arriba.
                <div className="pt-2">
                  <Tabs
                    items={screen.tabs}
                    value={tab}
                    onChange={setTab}
                    variant="underline"
                    size="sm"
                    scrollable
                  />
                </div>
              )}
            </AppHeader>
  
            {/* pb-20 reserva el alto del BottomNav, que es fixed y no ocupa flujo.
                En md+ la barra se auto-oculta y el padding extra ya no hace falta. */}
            <main className="flex-1 min-w-0 w-full max-w-2xl mx-auto px-5 pt-4 pb-20 md:pb-8">
              {children}
            </main>
          </SafeArea>
  
          {/* Fuera del SafeArea: BottomNav es fixed y ya trae su propio
              pb-[env(safe-area-inset-bottom)]. Meterlo adentro le sumaría el
              padding lateral del contenedor sin necesidad. */}
          <BottomNav items={navItems} />
  
          {/* Refresca la campana cuando la notificación no la disparó esta
              pestaña (un push del server, otro dispositivo, un cron). */}
          {authed && <NotificationSync unread={unread} />}

          {/* El panel de notificaciones en versión sidebar: entra desde el borde
              derecho a todo lo alto en vez de abrir un BottomSheet. */}
          <NotificationDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            items={notifications.items}
            title="Notificaciones"
            emptyTitle="Todo al día"
            emptyHint="Cuando pase algo importante te avisamos por acá."
            onRead={notifications.read}
            onReadAll={notifications.readAll}
            onDismiss={notifications.dismiss}
            onClear={notifications.clear}
            // El panel no navega solo con `href`: expone el item y deja la
            // decisión afuera. Cerramos el cajón antes de navegar, si no queda
            // abierto tapando la pantalla a la que acaba de llevar.
            onItemClick={(item: AppNotification) => {
              setDrawerOpen(false);
              if (item.href) router.push(item.href);
            }}
            footer={
              <Link
                href={ROUTES.notificaciones}
                onClick={() => setDrawerOpen(false)}
                className="block text-center text-sm text-muted hover:text-foreground py-1"
              >
                Configurar notificaciones
              </Link>
            }
          />
        </ShellSearchProvider>
      </div>
    </ShellTabsProvider>
  );
}
