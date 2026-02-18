import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://contourmapstudio.com";

export const metadata: Metadata = {
  title: {
    default: "Contour Map Studio — Turn your adventures into art",
    template: "%s | Contour Map Studio",
  },
  description:
    "Upload a GPX route and create a stunning personalised contour map poster of your hike, run, or ride. Prints shipped worldwide.",
  metadataBase: new URL(appUrl),
  openGraph: {
    type: "website",
    siteName: "Contour Map Studio",
    title: "Contour Map Studio — Turn your adventures into art",
    description:
      "Upload a GPX route and create a stunning personalised contour map poster of your hike, run, or ride. Prints shipped worldwide.",
    images: [
      {
        url: "/images/Peaks-Por-Da.png",
        width: 600,
        height: 800,
        alt: "Example contour map poster",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contour Map Studio — Turn your adventures into art",
    description:
      "Upload a GPX route and create a stunning personalised contour map poster. Prints shipped worldwide.",
    images: ["/images/Peaks-Por-Da.png"],
  },
  icons: {
    icon: "/contour-logo.png",
    shortcut: "/contour-logo.png",
    apple: "/contour-logo.png",
  },
  keywords: [
    "contour map",
    "route art",
    "GPX poster",
    "hiking poster",
    "cycling art",
    "running map",
    "topographic print",
    "custom map poster",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        <CurrencyProvider>
          <CartProvider>
            {children}
            <CartDrawer />
            <Toaster position="bottom-center" richColors closeButton />
          </CartProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
