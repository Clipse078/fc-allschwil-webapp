import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SportClubEvo",
    template: "%s · SportClubEvo",
  },
  description: "Club Management WebApp — powered by SportClubEvo",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="de">
      <body className={`${inter.variable} ${barlowCondensed.variable}`}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
