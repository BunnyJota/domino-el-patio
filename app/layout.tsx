import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Dominó El Patio",
  description:
    "Anota el torneo de dominó en sala: rifa de parejas, todos contra todos, pre-eliminatoria y final.",
  applicationName: "Dominó El Patio",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  appleWebApp: { capable: true, title: "El Patio", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d2118",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
