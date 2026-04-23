export const BRANDING = {
  clubName: "FC Allschwil",
  systemName: "VereinsOS",
  supportEmail: "VereinsOS@fcallschwil.ch",
} as const;

export function getFullSystemName() {
  return `${BRANDING.clubName} ${BRANDING.systemName}`;
}
