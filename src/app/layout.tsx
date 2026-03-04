import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LoveYou | A private world for two",
  description:
    "Một không gian riêng - chỉ dành cho hai người - nơi cảm xúc được nhìn thấy.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LoveYou",
  },
};

import AuthProvider from "@/components/providers/AuthProvider";
import BottomNav from "@/components/ui/bottom-nav";
import ServiceWorkerRegister from "@/components/providers/ServiceWorkerRegister";

export const viewport = {
  themeColor: "#ffe4e6", // love-100
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${inter.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <AuthProvider>
          <ServiceWorkerRegister />
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
