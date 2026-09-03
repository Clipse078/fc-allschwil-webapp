"use client";

import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth-actions";

type SignOutFormProps = {
  children: ReactNode;
  className?: string;
};

export default function SignOutForm({ children, className }: SignOutFormProps) {
  async function handleSignOut() {
    await signOutAction();
    window.location.assign("/login");
  }

  return (
    <form action={handleSignOut} className={className}>
      {children}
    </form>
  );
}
