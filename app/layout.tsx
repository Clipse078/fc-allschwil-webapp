import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
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
    default: "FC Allschwil · SportClubEvo",
    template: "%s · FC Allschwil",
  },
  description: "Club Management WebApp für FC Allschwil — powered by SportClubEvo",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="de">
      <body className={`${inter.variable} ${barlowCondensed.variable}`}>
        {children}
      </body>
    </html>
  );
}
