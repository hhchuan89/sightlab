import type { Metadata } from "next";
import { Newsreader, Source_Serif_4, JetBrains_Mono, Noto_Serif_SC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/request";
import { ThemeScript } from "@/components/theme/ThemeScript";
import "./globals.css";

// Running prose body face — variable, optical-size axis so glyph shaping adapts
// across sizes. axes:["opsz"] is ONLY valid with weight:"variable".
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

// Display/headings only.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
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

// SC, not TC: the product's Chinese content is Simplified (zh-CN); TC serves
// Traditional regional glyph forms for shared codepoints (audit 20260704).
// 400 = body workhorse; 600 matches Source Serif's semibold headings so mixed
// Han/Latin headlines carry ONE weight; 700 = true bold. 500/900 had no Han use.
const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif-sc",
  display: "swap",
  // Google serves the CJK glyphs via unicode-range, not a named subset,
  // so next/font can't preload them — disable preload rather than preload Latin.
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "SightLab — Market Observatory",
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
      className={`${newsreader.variable} ${sourceSerif.variable} ${jetBrainsMono.variable} ${notoSerifSC.variable}`}
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
