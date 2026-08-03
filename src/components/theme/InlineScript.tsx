"use client";

/**
 * Script inline que corre durante el parseo del HTML.
 *
 * El `type` cambia según dónde se renderice: `text/javascript` en el server (el
 * browser lo ejecuta al parsearlo) y `text/plain` en el cliente (inerte). React
 * sólo avisa "Encountered a script tag while rendering React component" cuando
 * el `type` es un MIME de JavaScript — con cualquier otro lo trata como un
 * bloque de datos y lo deja pasar. El script ya se ejecutó al parsear el HTML,
 * así que volver a crearlo en el cliente no haría nada de todos modos.
 *
 * **`"use client"` no es opcional.** Sin él este es un Server Component, y
 * entonces `typeof window` se evalúa *siempre* en el server: el `text/plain`
 * no llega a existir nunca y el RSC payload viaja con `text/javascript`
 * horneado. En cuanto React reconstruye este árbol del lado del cliente (una
 * revalidación del layout raíz, un `router.refresh()`, o el fallback tras un
 * error de render en el server) crea el `<script>` con el MIME de JavaScript y
 * dispara el aviso. Marcándolo como Client Component, la rama del cliente
 * existe de verdad.
 *
 * `suppressHydrationWarning` es por la diferencia de `type` entre server y
 * cliente, que es intencional.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
