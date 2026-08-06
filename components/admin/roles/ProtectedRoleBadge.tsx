import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

/**
 * Marks a role as system-protected (`Role.isSystem === true`) — cannot be
 * deleted/archived, renamed, or have its scope changed. See
 * `lib/roles/protected.ts` for the enforcement logic this badge documents.
 */
export default function ProtectedRoleBadge() {
  return (
    <Badge variant="warning">
      <Lock className="h-3 w-3" aria-hidden="true" />
      Geschützt
    </Badge>
  );
}
