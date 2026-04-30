import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main className={["mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8", className].join(" ")}>
      {children}
    </main>
  );
}
