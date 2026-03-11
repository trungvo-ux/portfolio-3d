import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/IBMPlexMono-Medium.ttf",
  weight: "500",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/IBMPlexMono-Medium.ttf",
  weight: "500",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Trung's Portfolio",
  description: "Portfolio using Three.JS",
  icons: {
    icon: "/icon.png?v=2",
    shortcut: "/icon.png?v=2",
    apple: "/icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
