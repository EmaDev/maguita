/* Service worker de Maguita.
 *
 * La versión NO se escribe acá. Llega en el query string con el que lo registra
 * el shell — `SW_URL` en `src/lib/app-config.ts`, o sea `/sw.js?v=<APP_VERSION>`
 * — y de ahí salen los nombres de los caches. Así hay un solo número que tocar
 * para publicar: bumpear `APP_VERSION` cambia la scriptURL del worker (el
 * navegador lo trata como uno nuevo y lo deja en `waiting`, que es lo que hace
 * aparecer el aviso de `UpdatePrompt`) y de paso invalida todo lo cacheado,
 * porque `activate` borra las caches que no empiecen con esta `CACHE_VERSION`.
 *
 * El `?? "dev"` cubre a quien registre `/sw.js` pelado (DevTools, o una pestaña
 * vieja anterior a este cambio): sigue funcionando, sólo que sin versionar.
 */
const APP_VERSION = new URL(self.location.href).searchParams.get("v") ?? "dev";
const CACHE_VERSION = `maguita-v${APP_VERSION}`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* Handshake que espera useServiceWorker/UpdatePrompt para activar la versión
 * nueva sin que el usuario tenga que cerrar todas las pestañas. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

/** Assets con hash en el nombre: inmutables, cache-first. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** Navegaciones: red primero (los datos de sesión no se pueden servir viejos),
 *  y sólo si falla la red se cae a la última copia o a la pantalla offline. */
async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    return (
      offline ??
      new Response("Sin conexión", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear las respuestas de los Server Actions ni los payloads RSC:
  // devolver una versión vieja rompería el estado de la sesión.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

/* Notificaciones push (usePushSubscription / NotificationOptIn).
 *
 * El payload lo arma `sendWebPush` (src/lib/notifications/web-push.ts):
 * { title, body, url, tag, badgeCount }.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Maguita", body: event.data.text() };
  }

  const url = payload.url ?? "/inicio";

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title ?? "Maguita", {
        body: payload.body ?? "",
        icon: payload.icon ?? "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        // Con `tag`, un aviso nuevo del mismo evento reemplaza al anterior en
        // la bandeja del sistema en vez de apilar dos veces lo mismo.
        tag: payload.tag,
        data: { url },
      }),
      setAppBadge(payload.badgeCount),
      // El push llegó desde el servidor: las pestañas abiertas tienen la
      // campana desactualizada y no se enteran solas. Este mensaje es lo que
      // dispara el router.refresh() de <NotificationSync>.
      notifyClients({ type: "PUSH_RECEIVED", url }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/inicio";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })()
  );
});

/** Contador en el ícono de la app instalada. No está en todas partes (iOS, Firefox). */
async function setAppBadge(count) {
  if (typeof count !== "number" || !self.navigator?.setAppBadge) return;
  try {
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    /* El badge es decorativo: que falle no puede tumbar el resto del handler. */
  }
}

/** Avisa a todas las pestañas de la app, estén enfocadas o no. */
async function notifyClients(message) {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clientList) client.postMessage(message);
}
