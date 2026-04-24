import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
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

const APP_NAME = "Midi Master";
const APP_DESCRIPTION =
  "PWA d'entraînement aux 12 Coups de Midi — deviens Maître de Midi.";

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
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F4D",
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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
