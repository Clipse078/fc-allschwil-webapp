import { prisma } from "@/lib/db/prisma";

// Checks whether a WEBSITE PUBLISH action requires review for the given role.
// Uses the existing RoleWorkflowRule infrastructure (domain=WEBSITE, action=PUBLISH).
// Returns true if ANY active rule for this role requires review.
// Returns false if a rule explicitly allows direct publishing (allowsDirectManage=true).
// Returns null if no rule is configured (caller should choose a safe default).
export async function websitePublishRequiresReview(
  roleId: string,
): Promise<boolean | null> {
  const rule = await prisma.roleWorkflowRule.findUnique({
    where: { roleId_domain_action: { roleId, domain: "WEBSITE", action: "PUBLISH" } },
    select: {
      requiresReview: true,
      allowsDirectManage: true,
      isActive: true,
    },
  });

  if (!rule || !rule.isActive) return null;
  if (rule.allowsDirectManage) return false;
  return rule.requiresReview;
}

// Returns reviewer role IDs for WEBSITE PUBLISH, if any are configured.
export async function getWebsiteReviewerRoles(roleId: string): Promise<string[]> {
  const rule = await prisma.roleWorkflowRule.findUnique({
    where: { roleId_domain_action: { roleId, domain: "WEBSITE", action: "PUBLISH" } },
    select: {
      reviewAssignments: {
        where: { isRequired: true },
        select: { reviewerRoleId: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return rule?.reviewAssignments.map((a) => a.reviewerRoleId) ?? [];
}
