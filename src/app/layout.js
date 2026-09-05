import { Inter } from "next/font/google";
import { Providers } from "./providers";
import config from "@/lib/config";
import "./globals.css";

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
      </body>
    </html>
  );
}
