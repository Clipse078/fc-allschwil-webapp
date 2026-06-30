"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type StopPropagationLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "onClick">;

/**
 * A client-side `Link` wrapper that stops click propagation to parent elements.
 *
 * Use this when an action link (e.g. "Edit") is nested inside a larger
 * navigable container (e.g. a card Link). Without stopping propagation the
 * outer Link intercepts the click and navigates to the wrong route.
 *
 * Must be a Client Component so the onClick event handler can be attached.
 * Parent server components can safely render this as a leaf node.
 */
export default function StopPropagationLink({
  children,
  ...props
}: StopPropagationLinkProps) {
  return (
    <Link {...props} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}
