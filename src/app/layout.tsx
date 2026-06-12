import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono, Noto_Serif_TC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/request";
import { ThemeScript } from "@/components/theme/ThemeScript";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const notoSerifTC = Noto_Serif_TC({
  weight: ["500", "700", "900"],
  variable: "--font-noto-serif-tc",
  display: "swap",
  // Google serves the TC (CJK) glyphs via unicode-range, not a named subset,
  // so next/font can't preload them — disable preload rather than preload Latin.
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "SightLab — Market Intelligence",
    template: "%s · SightLab",
  },
  description:
    "A deterministic daily dispatch on where the market cycle stands: sector fund flows and Weinstein-stage positioning.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${sourceSerif.variable} ${jetBrainsMono.variable} ${notoSerifTC.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="bg-bg text-text antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
