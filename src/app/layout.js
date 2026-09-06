import { Inter } from "next/font/google";
import Script from "next/script";
import { Providers } from "./providers";
import config from "@/lib/config";
import "./globals.css";

// Same Google Analytics property the static hub page uses; only loaded in production.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-5CS8PVKYP6";
const isProd = process.env.NODE_ENV === "production";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: "H3 Max Studio",
    template: "%s · H3 Max Studio",
  },
  description: "Ready-made MiniMax H3 Max video tools: pick a scenario, add a photo or a sentence, get a clip.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    siteName: "h3max.info",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} data-theme="slate-indigo">
      <body className={`${inter.className} h-full antialiased bg-bg-page text-primary-text`}>
        <Providers>{children}</Providers>
        {isProd && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
            <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
          </>
        )}
      </body>
    </html>
  );
}
