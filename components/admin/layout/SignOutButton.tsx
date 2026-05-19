"use client";

import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  collapsed?: boolean;
};

export default function SignOutButton({
  collapsed = false,
}: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title={collapsed ? "Abmelden" : undefined}
      className={
        collapsed
          ? "sce-action-danger w-full px-3 py-3 text-xs font-semibold"
          : "sce-action-danger w-full px-4 py-2.5 text-sm font-semibold"
      }
    >
      {collapsed ? "Logout" : "Abmelden"}
    </button>
  );
}
