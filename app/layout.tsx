import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import DeliveryScheduler from "@/components/DeliveryScheduler";
import SessionProvider from "@/components/SessionProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SessionValidatorWrapper } from "@/components/SessionValidatorWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VFX Tracker - Production Coordination System",
  description: "Professional VFX production tracking and coordination system",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VFX Tracker",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <QueryProvider>
            <SessionValidatorWrapper>
              <Toaster position="top-right" />
              <DeliveryScheduler />
              {children}
            </SessionValidatorWrapper>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
