import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
export const metadata = { title: "BC Truck Works | Live Companion", description: "Your browser-based trucking co-driver for ATS, ETS2, and your favorite apps.", applicationName: "BC Truck Works Live Companion", themeColor: "#08111f", manifest: "/manifest.webmanifest" };
export default function RootLayout({ children }) { return <html lang="en"><body>{children}<Analytics /><Script src="/register-sw.js" strategy="afterInteractive" /></body></html>; }
