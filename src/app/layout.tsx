import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { ConsoleFilter } from "@/components/layout/ConsoleFilter";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

// K4 — Le metadata HTML est server-side et est rendu AVANT l'auth.
// Il est donc IMPOSSIBLE de le rendre conditionnel par utilisateur.
// On garde donc le branding générique. Le compte owner verra
// "Coups de Midi Quiz" dans l'icône d'install PWA et dans l'onglet —
// limitation acceptée. Le branding personnalisé Mahylan apparaît dès
// que la page (app)/ est rendue (Navbar, accueil, hero).
const APP_NAME = "Coups de Midi Quiz";
const APP_DESCRIPTION =
  "Application de quiz multijoueur inspirée des 12 Coups de Midi.";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s — ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0E27" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${montserrat.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ConsoleFilter />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
