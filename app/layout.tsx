import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
      <body className={`${GeistSans.variable} ${inter.variable}`}>
        {children}
      </body>
    </html>
  );
}
