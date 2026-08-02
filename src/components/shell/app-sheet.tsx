"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { BottomSheet, type BottomSheetSize } from "lib-kit-components";

/**
 * `BottomSheetProps` no está en el barrel export de la librería, así que
 * declaramos las opciones que realmente usamos.
 */
export interface AppSheetOptions {
  title?: string;
  description?: string;
  size?: BottomSheetSize;
  footer?: ReactNode;
  showClose?: boolean;
  snapPoints?: number[];
}

interface AppSheetValue {
  openSheet: (content: ReactNode, options?: AppSheetOptions) => void;
  closeSheet: () => void;
}

const AppSheetContext = createContext<AppSheetValue | null>(null);

/**
 * Sustituye al `useAppSheet()` de la librería, que sólo funciona dentro de
 * `PackageApp`. Un único `BottomSheet` montado en el shell que cualquier
 * pantalla puede abrir, sin repetir `useState` + `<BottomSheet>` en cada una.
 */
export function useAppSheet(): AppSheetValue {
  const value = useContext(AppSheetContext);
  if (!value) {
    throw new Error("useAppSheet() necesita un <AppSheetProvider> por encima.");
  }
  return value;
}

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [content, setContent] = useState<ReactNode>(null);
  const [options, setOptions] = useState<AppSheetOptions>({});

  // `path` guarda la ruta en la que se abrió. El sheet lo abre la pantalla en
  // la que estás (ej. "Nuevo gasto" desde Movimientos, con un `cycleId`
  // propio de ese momento): si el usuario navega con el BottomNav sin
  // cerrarlo a mano, en la ruta nueva `path` ya no matchea y queda cerrado
  // solo, sin un efecto aparte — misma técnica que la tab activa y el
  // buscador de `AppShell` (`AppFrame`).
  const [sheet, setSheet] = useState({ path: pathname, open: false });
  const open = sheet.path === pathname && sheet.open;

  const openSheet = useCallback(
    (next: ReactNode, nextOptions?: AppSheetOptions) => {
      setContent(next);
      setOptions(nextOptions ?? {});
      setSheet({ path: pathname, open: true });
    },
    [pathname]
  );

  // Sólo bajamos `open`: el contenido queda montado para que la animación de
  // salida del sheet no se corte en seco.
  const closeSheet = useCallback(() => setSheet((s) => ({ ...s, open: false })), []);

  const value = useMemo(() => ({ openSheet, closeSheet }), [openSheet, closeSheet]);

  return (
    <AppSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        open={open}
        onClose={closeSheet}
        size={options.size ?? "auto"}
        title={options.title}
        description={options.description}
        footer={options.footer}
        showClose={options.showClose}
        snapPoints={options.snapPoints}
      >
        {content}
      </BottomSheet>
    </AppSheetContext.Provider>
  );
}
