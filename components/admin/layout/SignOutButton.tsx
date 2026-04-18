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
          ? "w-full rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700"
          : "w-full rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 shadow-sm"
      }
    >
      {collapsed ? "Logout" : "Abmelden"}
    </button>
  );
}
