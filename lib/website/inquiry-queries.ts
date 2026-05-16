import { prisma } from "@/lib/db/prisma";

export type InquiryListItem = {
  id: string;
  type: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string | null;
  message: string;
  sourcePath: string | null;
  notificationStatus: string;
  notificationError: string | null;
  createdAt: Date;
};

export const INQUIRY_TYPE_LABELS: Record<string, string> = {
  CONTACT: "Kontakt",
  REGISTRATION_INTEREST: "Probetraining",
  SPONSOR_INTEREST: "Sponsor",
  TRAINER_INTEREST: "Trainer",
  VOLUNTEER_INTEREST: "Freiwillig",
};

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  NEW: "Neu",
  IN_PROGRESS: "In Bearbeitung",
  RESOLVED: "Erledigt",
  ARCHIVED: "Archiviert",
};

export async function getInquiryList(
  siteId: string,
  statusFilter?: string | null
): Promise<InquiryListItem[]> {
  const where: Record<string, unknown> = { siteId };
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  const rows = await prisma.websiteInquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      name: true,
      email: true,
      phone: true,
      topic: true,
      message: true,
      sourcePath: true,
      notificationStatus: true,
      notificationError: true,
      createdAt: true,
    },
  });
  return rows as InquiryListItem[];
}

export type InquiryDetailData = InquiryListItem & {
  handledByUserId: string | null;
  notificationLastAttemptAt: Date | null;
};

export async function getInquiryDetail(
  inquiryId: string,
  siteId: string
): Promise<InquiryDetailData | null> {
  const row = await prisma.websiteInquiry.findFirst({
    where: { id: inquiryId, siteId },
    select: {
      id: true,
      type: true,
      status: true,
      name: true,
      email: true,
      phone: true,
      topic: true,
      message: true,
      sourcePath: true,
      handledByUserId: true,
      notificationStatus: true,
      notificationLastAttemptAt: true,
      notificationError: true,
      createdAt: true,
    },
  });
  return row as InquiryDetailData | null;
}

export async function countNewInquiries(siteId: string): Promise<number> {
  return prisma.websiteInquiry.count({
    where: { siteId, status: "NEW" },
  });
}

export async function countFailedNotifications(siteId: string): Promise<number> {
  return prisma.websiteInquiry.count({
    where: { siteId, notificationStatus: "FAILED" },
  });
}
