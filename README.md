# Maguita

PWA con Next.js 16 (App Router) armada sobre [`lib-kit-components`](https://github.com/EmaDev/kit-componentes): rutas protegidas con sesión, una ruta pública, tema claro/oscuro, bottom tab bar, header de app, splash, instalador y soporte sin conexión.

## Arrancar

```bash
cp .env.example .env.local     # y completá las claves de Firebase
npm run dev
```

La app necesita un proyecto de Firebase con **Authentication** (proveedor *Correo electrónico/contraseña*) y **Firestore** habilitados:

1. Config pública del Web app → las `NEXT_PUBLIC_FIREBASE_*`.
2. Cuentas de servicio → *Generar nueva clave privada* → el JSON entero, en una sola línea, en `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Publicá las reglas: `firebase deploy --only firestore:rules` (ver `firestore.rules`).

No hay cuenta de prueba: creá la tuya desde `/signin`.

## Rutas

| Ruta | Acceso | Pantalla |
|---|---|---|
| `/inicio` | protegida | 4 tabs: resumen (dashboard), movimientos, notas y hábitos |
| `/favoritos` | protegida | Mini-apps guardadas, con filtro y quitar/deshacer |
| `/asistente` | protegida | Chat con respuestas locales |
| `/ajustes` | protegida | Tema, instalación, permisos, almacenamiento, diagnóstico PWA |
| `/mini-apps` | **pública** | Catálogo con filtros; se enriquece si hay sesión |
| `/login`, `/signin`, `/recuperar-password` | pública | Ingreso, registro y recuperación en 3 pasos |
| `/offline`, `/` , `404` | pública | Fallback del service worker, redirect y no-encontrado |

`/` manda a `/inicio` con sesión y a `/mini-apps` sin ella.

## Cómo se protegen las rutas

Dos capas, a propósito:

1. **`src/proxy.ts`** — en Next.js 16 el `middleware` se llama `proxy`. Hace un chequeo **optimista**: si la ruta es protegida y no hay cookie, redirige a `/login?next=…`. Es barato y evita renderizar de más, pero no valida la firma.
2. **`requireSession()`** (`src/lib/auth/dal.ts`) — corre en cada layout/página protegida y es la verificación real: valida la firma de Firebase y la expiración. Una cookie falsificada pasa el proxy pero muere acá.

La sesión es una **session cookie de Firebase** (`src/lib/auth/session.ts`): `httpOnly` + `sameSite=lax`, firmada por Google, 7 días. Verificarla no cuesta red — la firma se chequea contra las claves públicas que el Admin SDK cachea. Para lo sensible está `requireFreshSession()`, que además le pregunta a Firebase si la sesión fue revocada.

Las contraseñas las guarda y valida **Firebase Auth**; la app nunca las almacena. El login corre en una Server Action que valida contra la REST API de Identity Toolkit (`src/lib/auth/identity.ts`) y canjea el ID token por la cookie — así la contraseña no pasa por el cliente ni hace falta el SDK de auth en el bundle.

## Firebase

| Módulo | Para qué |
|---|---|
| `src/lib/firebase/admin.ts` | Admin SDK (`server-only`): Auth y Firestore con privilegios totales |
| `src/lib/firebase/collections.ts` | Registro de colecciones + referencias tipadas |
| `src/lib/firebase/client.ts` | SDK del browser, lazy — para Cloud Messaging y `onSnapshot` |
| `src/lib/firebase/config.ts` | Config pública, compartida entre server y cliente |
| `firestore.rules` | Reglas del acceso desde el cliente: lee lo suyo, no escribe nada |

Para sumar una colección: agregá la clave en `COLLECTIONS`, su interfaz de documento y la entrada en `CollectionTypes`; después `collection(COLLECTIONS.loQueSea)` ya viene tipada. Sumale su regla en `firestore.rules` — el `match /{document=**}` final deja cerrada toda colección nueva.

Las escrituras pasan siempre por Server Actions, que revalidan la sesión: una Server Action es un endpoint público y no puede confiar en que la pantalla que la llamó ya estaba protegida.

Para trabajar sin tocar el proyecto real, contra los emuladores (necesitan JDK):

```bash
npx firebase-tools emulators:start --only auth,firestore
```

Y en `.env.local`, además de las claves: `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` y `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. El Admin SDK las lee solo, y `lib/auth/identity.ts` hace lo mismo con el endpoint REST del login.

## Sin datos, a propósito

La app es el esqueleto: **no hay datos sembrados**. Cuentas y favoritos ya persisten en Firebase; el resto de `src/lib/data/` sigue devolviendo colecciones vacías y cada pantalla muestra su empty state — Inicio (movimientos, notas, hábitos), el catálogo de mini-apps y las notificaciones de la campana. Los tipos y las firmas ya son los definitivos, así que conectarlos es reemplazar el cuerpo de cada función siguiendo el patrón de `data/favorites.ts`, sin tocar los componentes.

## Estructura

```
src/
  app/
    layout.tsx              # Server · ThemeProvider + ToastProvider + metadata PWA
    manifest.ts             # Web app manifest (ruta /manifest.webmanifest)
    page.tsx                # redirect según sesión
    (auth)/                 # login · signin · recuperar-password (shell propio, sin nav)
    (app)/                  # rutas protegidas — layout llama a requireSession()
    (public)/               # mini-apps — mismo shell, sin exigir sesión
    offline/                # fallback de navegación del service worker
  components/
    atoms/ molecules/ organisms/
    shell/AppShell.tsx      # Client · único límite cliente del shell
    shell/app-sheet.tsx     # BottomSheet global + useAppSheet() propio
  lib/
    app-config.ts           # nombre, versión y tabla de rutas
    auth/                   # session · users · identity · dal · actions · validation
    firebase/               # admin · client · collections · config
    data/                   # acceso a datos (sólo desde Server Components)
  proxy.ts
public/
  sw.js                     # service worker
  icons/                    # 192, 512, maskable 512, apple-touch 180
scripts/
  generate-icons.mjs        # dibuja los íconos con los colores de marca
firestore.rules             # security rules del acceso desde el cliente
```

El límite cliente/servidor está en `AppShell`, no en los `layout.tsx`/`page.tsx`. Eso mantiene el SSR real: el contenido de cada pantalla se renderiza en el servidor y llega en el HTML inicial; sólo hidratan el shell y los organisms que necesitan interacción.

## Lo que aporta la PWA

- **Safe areas** — `AppHeader` (top), `BottomNav` (bottom) y un `SafeArea edges={["left","right"]}` en el shell. `globals.css` pone el padding del `body` en 0 para no duplicar los insets que aplica la librería. `viewportFit: "cover"` en el `viewport` es lo que hace que `env(safe-area-inset-*)` valga algo en iOS.
- **Splash** — variante `zoom` con fondo de marca, una vez por sesión.
- **Instalador** — `PwaInstallPrompt` proactivo (banner Android/desktop, sheet con pasos en iOS) más un `InstallButton` en Ajustes.
- **Actualizaciones** — `UpdatePrompt` registra `/sw.js` y avisa cuando hay versión nueva (handshake `SKIP_WAITING`). Para publicar una versión, bumpeá `CACHE_VERSION` en `public/sw.js`.
- **Offline** — navegaciones network-first con fallback a la última copia y, si no hay, a `/offline`. Los assets con hash van cache-first. Los payloads RSC y los Server Actions nunca se cachean.
- **Tema** — provider propio en `components/theme/`: un script inline en el `<head>` aplica la clase `dark` antes del primer paint (sin flash) y `ThemeProvider` maneja el estado con `useSyncExternalStore` (incluye sincronía entre pestañas). Los tokens `--color-*` se pisan en `globals.css` (bloque `@theme` para claro, `.dark` para oscuro) y `useStatusBarColor` acompaña la barra de estado del sistema.

## Paleta

Bordó. El primario es `#8a1538` y el acento un rosa vino (`#b8455f`) que es el otro extremo de los degradés; en oscuro los dos se aclaran (`#e05e7d` / `#d98aa5`), porque el bordó original no llega al contraste mínimo sobre un fondo oscuro. Los neutros llevan una pizca de rojo para no verse fríos al lado de la marca, y `success`/`danger` están declarados en el proyecto (no los de la librería): el verde por defecto no llegaba a 4.5:1 sobre blanco y el rojo de error necesita separarse del bordó.

Todo sale de `src/app/globals.css`. Cambiar la paleta es tocar esos dos bloques y después:

```bash
npm run icons     # regenera public/icons con el nuevo degradé (scripts/generate-icons.mjs)
```

Los cuatro PNG se dibujan sin dependencias (buffer RGBA + `zlib`) con la misma marca que `BrandMark`. Fuera de `globals.css` los colores están hardcodeados en tres lugares que **no** leen CSS: `themeColor` del `viewport` (`layout.tsx`), `theme_color` del manifest y `useStatusBarColor` en el shell. Y como los íconos se sirven cache-first con el mismo nombre, hay que bumpear `CACHE_VERSION` en `public/sw.js` para que los instalados no se queden con los viejos.

## Verificación

```bash
npx tsc --noEmit
npx eslint .
npm run build
```

## Detalles no obvios

- `@source "../../node_modules/lib-kit-components/dist"` en `globals.css` es obligatorio: Tailwind v4 no escanea `node_modules`, y sin eso los componentes de la librería salen sin estilos.
- El `AppHeader` cambia de título por ruta desde `components/shell/nav-config.tsx`. Hay una sola instancia montada en el shell, que resuelve su contenido con `usePathname()` en vez de que cada pantalla monte el suyo — de esa forma el shell no se desmonta al cambiar de tab, el splash no se redispara y no se reinicia la animación del indicador del bottom nav.
- El shell **no** usa `PackageApp`: monta las piezas una por una (`NativeShell` → `SnackbarProvider` → `AppSheetProvider` → overlays → `SafeArea` → `AppHeader` → `main` → `BottomNav`). `useAppSheet()` de la librería sólo existe dentro de `PackageApp`, así que `components/shell/app-sheet.tsx` provee un equivalente propio.
- El `<main>` lleva `pb-24` porque `BottomNav` es `fixed` y no ocupa flujo; en `md+` la barra se auto-oculta y el padding baja a `pb-8`.
- `PwaInstallPrompt` y `UpdatePrompt` fijan su offset inferior y no lo exponen como prop, así que quedarían tapando el bottom nav. `globals.css` los levanta con un selector acotado a los banners centrados (`left-1/2`) dentro de `[data-app-shell="with-nav"]`.
- El buscador del header se comunica con la pantalla vía `components/shell/shell-search.tsx`, y se resetea al navegar guardando la ruta junto al término (sin `useEffect`).
- Las tabs de Inicio viven en el header (slot `children` del `AppHeader`, declaradas en `nav-config`) y la pantalla lee cuál está activa con `useShellTabs()`. Los ids están tipados con `HomeTab` (`components/organisms/home/tabs.ts`) para que la fila y los paneles no se desincronicen. No llevan `badge`: los contadores dependen de datos que el shell no tiene.
- Inicio mezcla los datos del server (`lib/data/home.ts`) con las altas locales del FAB (`lib/data/local-drafts.ts`, mismas claves que usa `quick-actions`), así que lo que se carga desde el `+` aparece enseguida en su tab, marcado como guardado en el dispositivo. La mezcla es SSR-safe porque `usePersistentState` devuelve la lista vacía hasta hidratar.
- El día de hoy lo calcula el **server** y baja como prop (`HomeData.today`): si el cliente lo recalculara, un browser en otro huso renderizaría "Hoy"/"Ayer" distinto al HTML del server. Por lo mismo, las fechas son *day keys* `yyyy-mm-dd` armadas con getters locales (nunca `toISOString()`) y el formato de moneda no usa `Intl.NumberFormat(style:"currency")`, cuyo símbolo y espaciado varían entre Node y el browser.
- El proyecto **no** usa `next-themes`. Su `ThemeProvider` renderiza el script de inicialización dentro de un Client Component, y React 19 avisa por consola ("Encountered a script tag while rendering React component") porque un `<script>` creado en un render de cliente nunca se ejecuta. `components/theme/InlineScript.tsx` sigue el patrón de la [guía de Next](https://nextjs.org/docs/app/guides/preventing-flash-before-hydration): `type="text/javascript"` en el server, `text/plain` en el cliente.
- Los controles que muestran el tema activo leen `mounted` del contexto: el HTML del server no puede saber qué hay en `localStorage`, así que hasta hidratar renderizan el estado neutro (tema claro, ninguna opción marcada) y recién después el real. Sin eso habría mismatch de hidratación.
