import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import ThemeProvider from "@/components/theme/ThemeProvider";
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
  title: "SportClubEvo WebApp",
  description: "Premium Operations-Plattform für moderne Sportclubs",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.variable} ${barlowCondensed.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
