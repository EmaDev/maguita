import type { BottomNavItem, TabItem } from "lib-kit-components";
import {
  GridIcon,
  HeartIcon,
  HomeIcon,
  SettingsIcon,
  SparkleIcon,
} from "@/components/atoms/icons";
import type { HomeTab } from "@/components/organisms/home/tabs";
import type { WorkoutTab } from "@/components/organisms/mini-apps/workout-tabs";
import { ROUTES } from "@/lib/app-config";

/** Tabs con sesión: las 4 rutas protegidas + la pública. */
export const AUTHED_NAV: BottomNavItem[] = [
  { label: "Inicio", href: ROUTES.inicio, icon: <HomeIcon /> },
  { label: "Favoritos", href: ROUTES.favoritos, icon: <HeartIcon /> },
  { label: "Asistente", href: ROUTES.asistente, icon: <SparkleIcon /> },
  { label: "Mini-apps", href: ROUTES.miniApps, icon: <GridIcon /> },
  { label: "Ajustes", href: ROUTES.ajustes, icon: <SettingsIcon /> },
];

/**
 * Sin sesión sólo tiene sentido ofrecer lo público. Mostrar los tabs
 * protegidos llevaría a un rebote al login en cada toque.
 */
export const GUEST_NAV: BottomNavItem[] = [
  { label: "Mini-apps", href: ROUTES.miniApps, icon: <GridIcon /> },
  { label: "Ingresar", href: ROUTES.login, icon: <HomeIcon /> },
];

/**
 * Tabs de Inicio. Sin `badge`: los contadores (movimientos, notas, hábitos)
 * dependen de los datos de la pantalla, y esta lista la resuelve el shell antes
 * de que la pantalla monte. El resumen ya muestra esos números.
 *
 * El `id` está tipado con `HomeTab` para que la lista y los paneles de
 * `HomeBoard` no se puedan desincronizar.
 */
export const HOME_TABS: (TabItem & { id: HomeTab })[] = [
  { id: "resumen", label: "Resumen" },
  { id: "movimientos", label: "Movimientos" },
  { id: "notas", label: "Notas" },
  { id: "habitos", label: "Hábitos" },
];

/**
 * Tabs de la mini-app de entrenamiento. Mismo criterio que `HOME_TABS`: el
 * `id` está tipado con `WorkoutTab` para que esta lista y los paneles de
 * `WorkoutTrainer` no se puedan desincronizar.
 */
export const WORKOUT_TABS: (TabItem & { id: WorkoutTab })[] = [
  { id: "rutinas", label: "Rutinas" },
  { id: "ejercicios", label: "Ejercicios" },
];

export interface ScreenHeader {
  title: string;
  subtitle?: string;
  largeTitle?: boolean;
  centerTitle?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * Fila de tabs debajo del título, en el slot `children` del `AppHeader`.
   * La pantalla lee cuál está activa con `useShellTabs()`.
   */
  tabs?: TabItem[];
  /**
   * Reemplaza `title`/`subtitle` por el saludo al usuario y pone su avatar en
   * el slot `leading`. El shell lo resuelve porque el saludo depende de la hora
   * del dispositivo y el nombre de la sesión — nada de eso es estático.
   * Sin sesión se ignora y cae al `title` de siempre.
   */
  welcome?: boolean;
  /** Pantalla secundaria (no un tab): muestra la flecha de volver en vez de `leading`. */
  back?: boolean;
}

/**
 * Config del header por ruta. Hay un único `AppHeader` montado en el shell, que
 * resuelve su contenido con `usePathname` en vez de que cada pantalla monte el
 * suyo: así el shell no se desmonta al cambiar de tab y no se redispara el
 * splash ni se reinicia la animación del indicador del BottomNav.
 */
export const SCREEN_HEADERS: Record<string, ScreenHeader> = {
  // `largeTitle` + tabs es el patrón nativo: el título grande colapsa al
  // scrollear y la fila de tabs queda pegada arriba.
  [ROUTES.inicio]: {
    title: "Inicio",
    largeTitle: true,
    tabs: HOME_TABS,
    welcome: true,
  },
  [ROUTES.favoritos]: {
    title: "Favoritos",
    largeTitle: true,
    searchable: true,
    searchPlaceholder: "Buscar en favoritos…",
  },
  [ROUTES.asistente]: { title: "Asistente", subtitle: "Siempre disponible" },
  [ROUTES.ajustes]: { title: "Ajustes", largeTitle: true },
  [ROUTES.editarPerfil]: { title: "Editar perfil", back: true },
  [ROUTES.notificaciones]: {
    title: "Notificaciones",
    subtitle: "Qué te avisamos y por dónde",
    back: true,
  },
  [ROUTES.miniApps]: {
    title: "Mini-apps",
    largeTitle: true,
    searchable: true,
    searchPlaceholder: "Buscar mini-apps…",
  },
  [ROUTES.miniAppCalculadoraPropinas]: { title: "Calculadora de propinas", back: true },
  [ROUTES.miniAppSplitGastos]: { title: "Split de gastos", back: true },
  [ROUTES.miniAppGeneradorQr]: { title: "Generador de QR", back: true },
  [ROUTES.miniAppRuletaDecisiones]: {
    title: "Ruleta de decisiones",
    subtitle: "Que decida el azar",
    back: true,
  },
  [ROUTES.miniAppSorteoExpres]: {
    title: "Sorteo exprés",
    subtitle: "Uno o varios ganadores",
    back: true,
  },
  [ROUTES.miniAppEntrenamiento]: {
    title: "Entrenamiento",
    subtitle: "Rutinas y constancia",
    back: true,
    tabs: WORKOUT_TABS,
    /* El buscador filtra la lista de la tab activa: rutinas en una,
       ejercicios en la otra. La biblioteca son ~100 ejercicios, así que sin
       buscador no se navega. */
    searchable: true,
    searchPlaceholder: "Buscar rutinas o ejercicios…",
  },
  [ROUTES.miniAppLinks]: {
    title: "Links guardados",
    back: true,
    searchable: true,
    searchPlaceholder: "Buscar por URL, descripción o categoría…",
  },
  /* La entrada existe siempre, aunque la pantalla sólo se renderice con
     `DEV_TOOLS=true`: este mapa es sólo el título del header, y quien no tenga
     la flag prendida recibe un 404 antes de llegar a verlo. */
  [ROUTES.debug]: { title: "Debug", subtitle: "Herramientas de desarrollo", back: true },
};

export function headerFor(pathname: string): ScreenHeader {
  // `/inicio/periodos/{cycleId}` es dinámica (id de Firestore), no puede
  // tener una entrada fija en `SCREEN_HEADERS` como el resto.
  if (pathname.startsWith(`${ROUTES.movementsPeriodos}/`)) {
    return { title: "Período anterior", back: true };
  }
  return SCREEN_HEADERS[pathname] ?? { title: "Maguita" };
}
