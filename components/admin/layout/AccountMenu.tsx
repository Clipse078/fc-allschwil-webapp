"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { LogOut, UserCircle2 } from "lucide-react";
import SignOutForm from "@/components/admin/layout/SignOutForm";
import { PopoverContent } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";

type AccountMenuProps = {
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string | null;
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function AccountMenu({
  firstName,
  lastName,
  email,
  imageUrl,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = getInitials(firstName, lastName);
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          "text-[0.7rem] font-bold text-white select-none overflow-hidden",
          "transition-[opacity,box-shadow] duration-[120ms]",
          "hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--header-bg)]",
          open && "ring-2 ring-[var(--sce-primary)] ring-offset-1 ring-offset-[var(--header-bg)]",
        )}
        style={imageUrl ? undefined : { background: "var(--sce-accent)" }}
        aria-label="Konto-Menü"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={fullName}
            width={28}
            height={28}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      <PopoverContent
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        role="dialog"
        matchAnchorWidth={false}
        maxHeight={320}
        className="sce-account-menu min-w-[220px] p-0"
      >
        <div className="px-4 py-3">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {fullName}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-2)]">{email}</p>
        </div>

        <div className="border-t border-[var(--border)]" />

        <Link
          href="/dashboard/account"
          onClick={() => setOpen(false)}
          className={cn(
            "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-2)]",
            "no-underline transition-colors duration-[120ms]",
            "hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
            "focus-visible:outline-none focus-visible:bg-[var(--surface-2)]",
          )}
        >
          <UserCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Mein Konto
        </Link>

        <div className="border-t border-[var(--border)]" />

        <SignOutForm>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm",
              "text-[var(--text-2)] transition-colors duration-[120ms]",
              "hover:bg-[var(--sce-danger-light)] hover:text-[var(--sce-danger)]",
              "focus-visible:outline-none focus-visible:bg-[var(--sce-danger-light)]",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Abmelden
          </button>
        </SignOutForm>
      </PopoverContent>
    </>
  );
}
