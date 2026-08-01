import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "lib-kit-components";
import { InlineScript } from "@/components/theme/InlineScript";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Sin esto las safe areas (env(safe-area-inset-*)) valen 0 en iOS y toda la
  // capa de SafeArea de la librería queda sin efecto.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#150c10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: el script del <head> agrega la clase `dark` al
    // <html> antes de hidratar, así que el markup del server no coincide a
    // propósito y React tiene que quedarse con lo que hay en el DOM.
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Antes del primer paint: sin esto se ve un flash de tema claro
            cuando la preferencia guardada es oscuro. */}
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-app bg-surface text-foreground antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
