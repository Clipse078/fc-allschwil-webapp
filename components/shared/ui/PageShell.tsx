import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps page content in a standard vertical stack with consistent gap/spacing.
 * Use inside any admin page as the outermost content wrapper.
 */
export default function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className={`flex flex-col gap-6 lg:gap-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
