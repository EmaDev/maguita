"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  const [content, setContent] = useState<ReactNode>(null);
  const [options, setOptions] = useState<AppSheetOptions>({});
  const [open, setOpen] = useState(false);

  const openSheet = useCallback((next: ReactNode, nextOptions?: AppSheetOptions) => {
    setContent(next);
    setOptions(nextOptions ?? {});
    setOpen(true);
  }, []);

  // Sólo bajamos `open`: el contenido queda montado para que la animación de
  // salida del sheet no se corte en seco.
  const closeSheet = useCallback(() => setOpen(false), []);

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
