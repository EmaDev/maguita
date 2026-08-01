/**
 * Script inline que corre durante el parseo del HTML.
 *
 * El `type` cambia según dónde se renderice: `text/javascript` en el server (el
 * browser lo ejecuta al parsearlo) y `text/plain` en el cliente (inerte). Es el
 * patrón que recomienda Next.js para que React no avise en desarrollo
 * ("Encountered a script tag while rendering React component"): un `<script>`
 * creado en un render de cliente nunca se ejecuta, así que React lo reporta.
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
