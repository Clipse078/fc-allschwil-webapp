export type NavItemConfig = {
  key: string;
  label: string;
  slug: string;
  visible: boolean;
  sortOrder: number;
  isCta?: boolean;
};

export type WebsiteNavConfig = {
  items: NavItemConfig[];
};

export const DEFAULT_NAV_CONFIG: WebsiteNavConfig = {
  items: [
    { key: "home", label: "Home", slug: "", visible: true, sortOrder: 0 },
    { key: "news", label: "News", slug: "news", visible: true, sortOrder: 1 },
    { key: "events", label: "Events", slug: "events", visible: true, sortOrder: 2 },
    { key: "teams", label: "Teams", slug: "teams", visible: true, sortOrder: 3 },
    { key: "sponsoren", label: "Sponsoren", slug: "sponsoren", visible: true, sortOrder: 4 },
    { key: "kontakt", label: "Kontakt", slug: "kontakt", visible: true, sortOrder: 5 },
  ],
};

export function resolveNavConfig(
  navConfigJson: unknown
): WebsiteNavConfig {
  if (
    navConfigJson &&
    typeof navConfigJson === "object" &&
    !Array.isArray(navConfigJson) &&
    "items" in navConfigJson &&
    Array.isArray((navConfigJson as Record<string, unknown>).items)
  ) {
    return navConfigJson as WebsiteNavConfig;
  }
  return DEFAULT_NAV_CONFIG;
}

export function getVisibleNavItems(config: WebsiteNavConfig): NavItemConfig[] {
  return config.items
    .filter((item) => item.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
