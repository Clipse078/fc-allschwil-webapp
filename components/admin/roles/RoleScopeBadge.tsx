import { Badge } from "@/components/ui/Badge";

type RoleScopeBadgeProps = {
  scope: "PLATFORM" | "TENANT";
};

/**
 * Makes a role's authorization scope unambiguous everywhere a role is
 * listed — the task's "make it obvious whether a role is PLATFORM or
 * TENANT scoped" requirement.
 */
export default function RoleScopeBadge({ scope }: RoleScopeBadgeProps) {
  if (scope === "PLATFORM") {
    return <Badge variant="secondary">PLATFORM</Badge>;
  }
  return <Badge variant="info">TENANT</Badge>;
}
