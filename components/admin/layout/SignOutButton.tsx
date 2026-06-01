"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/cn";

type SignOutButtonProps = {
  collapsed?: boolean;
};

export default function SignOutButton({ collapsed = false }: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title={collapsed ? "Abmelden" : undefined}
      className={cn(
        "sce-nav-item w-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50",
        collapsed && "justify-center px-2",
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!collapsed && <span>Abmelden</span>}
    </button>
  );
}
