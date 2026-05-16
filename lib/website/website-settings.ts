export type WebsiteSettings = {
  inquiryNotificationEmail?: string | null;
};

export function parseWebsiteSettings(settingsJson: unknown): WebsiteSettings {
  if (settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)) {
    return settingsJson as WebsiteSettings;
  }
  return {};
}

export function mergeWebsiteSettings(
  existing: unknown,
  patch: Partial<WebsiteSettings>
): WebsiteSettings {
  const base = parseWebsiteSettings(existing);
  return { ...base, ...patch };
}

export function getInquiryNotificationEmail(
  settingsJson: unknown,
  contactEmail: string | null | undefined
): string | null {
  const settings = parseWebsiteSettings(settingsJson);
  const fromSettings = settings.inquiryNotificationEmail?.trim();
  if (fromSettings) return fromSettings;
  const fromContact = contactEmail?.trim();
  if (fromContact) return fromContact;
  return null;
}
