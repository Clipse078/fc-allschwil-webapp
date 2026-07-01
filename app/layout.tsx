import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
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
      <body className={geist.variable}>
        {children}
      </body>
    </html>
  );
}
