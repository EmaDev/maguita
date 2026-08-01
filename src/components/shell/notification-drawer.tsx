"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NotificationPanel, type NotificationPanelProps } from "lib-kit-components";

/**
 * `NotificationPanel` en versión sidebar: un cajón que entra desde el borde
 * derecho y ocupa todo el alto, en vez del `BottomSheet` que usábamos antes.
 *
 * La librería no trae un contenedor lateral (`BottomSheet` es sólo de abajo,
 * `Modal` es centrado y `SideBar` es navegación con links), así que el cajón se
 * arma acá y el contenido sigue siendo el `NotificationPanel` del kit.
 *
 * Los z-index acompañan la escala de la guía "La base de una app": mismos
 * valores que `BottomSheet` (backdrop 140, panel 150), o sea por encima del
 * BottomNav, el FAB y los banners PWA, y por debajo del splash.
 */
interface NotificationDrawerProps
  extends Omit<NotificationPanelProps, "className" | "maxHeight"> {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({
  open,
  onClose,
  ...panel
}: NotificationDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Mismo bloqueo que hace BottomSheet: sin esto el fondo scrollea detrás
    // del cajón en iOS.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // El foco entra al cajón para que el lector de pantalla y el tabulador no
    // sigan recorriendo la pantalla de atrás.
    panelRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[140] bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={panel.title ?? "Notificaciones"}
            tabIndex={-1}
            className="fixed z-[150] top-0 right-0 bottom-0 w-[min(24rem,100vw-3rem)] flex flex-col bg-surface border-l border-border shadow-2xl outline-none"
            // Los insets van como padding del cajón: es fixed, así que no hereda
            // el <SafeArea> del shell.
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              paddingRight: "env(safe-area-inset-right, 0px)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            {/* El panel trae su propio look de tarjeta (borde, radio, sombra):
                acá va a sangre contra el borde de la pantalla, así que se lo
                sacamos con el modificador `!` de Tailwind v4 — sin él gana el
                orden del CSS generado, no el de la clase.

                maxHeight 100% no recorta nada: el área scrolleable es un flex
                item con `overflow-y-auto`, así que encoge sola hasta el espacio
                que le deja la cabecera del panel. */}
            <NotificationPanel
              {...panel}
              maxHeight="100%"
              className="flex-1 min-h-0 border-0! rounded-none! shadow-none! bg-transparent!"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
