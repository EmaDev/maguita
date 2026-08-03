import "server-only";
import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";

/**
 * Preview de un link: título/descripción/imagen sacados de sus metatags Open
 * Graph. `fetchLinkMetadata` es lo único que sabe pedirlos — la mini-app de
 * links los guarda ya resueltos en el alta (`addLinkAction`), no los vuelve a
 * pedir en cada lectura.
 */
export interface LinkMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const EMPTY: LinkMetadata = { title: null, description: null, image: null, siteName: null };

const FETCH_TIMEOUT_MS = 6000;
/** Alcanza para bajar `<head>`; evita descargar la página entera de un sitio pesado. */
const MAX_HTML_BYTES = 500_000;
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]!);
  return false;
}

/**
 * La URL la manda el usuario y el fetch corre en el server: sin esto, la
 * mini-app se podría usar para sondear la red interna del servidor (ej.
 * `http://169.254.169.254/...` o un `localhost` con un puerto de admin).
 * Resuelve el host y descarta cualquier IP privada/loopback/link-local antes
 * de pedirle nada.
 */
async function isPrivateTarget(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (isIPv4(host)) return isPrivateIPv4(host);
  if (isIPv6(host)) return isPrivateIPv6(host);
  try {
    const { address, family } = await lookup(host);
    return family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
  } catch {
    return true; // no resuelve = no se puede validar, se descarta
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, "i");
  const altRe = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, "i");
  const match = html.match(re) ?? html.match(altRe);
  return match ? decodeEntities(match[1]!.trim()) || null : null;
}

function parseMetaTags(html: string, pageUrl: string): LinkMetadata {
  const head = html.split(/<\/head>/i)[0] ?? html;

  const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const title = metaContent(head, "property", "og:title") ?? (titleTag ? decodeEntities(titleTag.trim()) || null : null);

  const description =
    metaContent(head, "property", "og:description") ?? metaContent(head, "name", "description");

  let image = metaContent(head, "property", "og:image") ?? metaContent(head, "name", "twitter:image");
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = null;
    }
  }

  const siteName = metaContent(head, "property", "og:site_name");

  return { title, description, image, siteName };
}

/**
 * Trae título/descripción/imagen de una URL vía sus metatags Open Graph (con
 * fallback a `<title>`/meta description/twitter:image). Sin librería de
 * parsing: un recorte de `<head>` + regex alcanza para metatags, que siempre
 * vienen bien formados por los sitios que los publican.
 *
 * Sigue redirects a mano (hasta `MAX_REDIRECTS`) en vez de dejar que `fetch`
 * los siga solo, validando cada salto contra `isPrivateTarget` — si no, un
 * sitio público podría redirigir a una IP interna y saltearse el chequeo.
 * Cualquier fallo (URL inválida, host privado, timeout, no-HTML, red) cae en
 * `EMPTY`: el link igual se guarda, sólo que sin preview.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return EMPTY;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") return EMPTY;
    if (await isPrivateTarget(current.hostname)) return EMPTY;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MaguitaLinkBot/1.0)",
          Accept: "text/html",
        },
      });
    } catch {
      return EMPTY;
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return EMPTY;
      try {
        current = new URL(location, current);
      } catch {
        return EMPTY;
      }
      continue;
    }

    if (!res.ok || !res.body) return EMPTY;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return EMPTY;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString("utf-8");
    return parseMetaTags(html, current.toString());
  }

  return EMPTY;
}
