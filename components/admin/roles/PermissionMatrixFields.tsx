"use client";

import NavAlignedPermissionEditor from "@/components/admin/roles/NavAlignedPermissionEditor";

export type PermissionMatrixModuleGroup = {
  module: string;
  permissions: Array<{ id: string; key: string; name: string; module: string }>;
};

type PermissionMatrixFieldsProps = {
  moduleGroups: PermissionMatrixModuleGroup[];
  selectedKeys: Set<string>;
  /** Keys that must always render checked and disabled (essential system-role permissions). */
  lockedKeys?: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  /** @deprecated Raw keys are no longer shown in Club Admin UX. */
  showRawKeys?: boolean;
};

/**
 * Navigation-aligned permission selector for tenant roles.
 * Presentation derives from NAV_SECTIONS — module grouping never gates access.
 */
export default function PermissionMatrixFields(props: PermissionMatrixFieldsProps) {
  return <NavAlignedPermissionEditor {...props} />;
}
