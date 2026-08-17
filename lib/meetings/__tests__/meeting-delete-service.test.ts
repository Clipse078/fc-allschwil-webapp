/**
 * ADMIN-HARD-DELETE-UI — Meeting delete service unit tests.
 *
 * Covers:
 *   MS-01  getMeetingDeletionImpact returns null for non-existent meeting
 *   MS-02  getMeetingDeletionImpact counts cascade children correctly
 *   MS-03  deleteMeetingPermanently returns null for non-existent meeting
 *   MS-04  deleteMeetingPermanently calls prisma.meeting.delete on success
 *   MS-05  deleteMeetingPermanently returns correct title and impact
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// Mock the prisma module before importing the service
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    meeting: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    targetDataPoint: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getMeetingDeletionImpact,
  deleteMeetingPermanently,
} from "@/lib/meetings/meeting-delete-service";

const mockPrisma = prisma as unknown as {
  meeting: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe("ADMIN-HARD-DELETE-UI — meeting-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMeetingDeletionImpact", () => {
    it("MS-01: returns null when meeting does not exist", async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce(null);
      const result = await getMeetingDeletionImpact("nonexistent");
      expect(result).toBeNull();
    });

    it("MS-02: returns correct counts for meeting with sub-entities", async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce({
        _count: {
          agendaItems: 3,
          decisions: 2,
          actions: 5,
          participants: 8,
        },
      });

      const result = await getMeetingDeletionImpact("meeting-1");
      expect(result).toEqual({
        agendaItems: 3,
        decisions: 2,
        actions: 5,
        participants: 8,
      });
    });

    it("MS-02b: returns zero counts for empty meeting", async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce({
        _count: {
          agendaItems: 0,
          decisions: 0,
          actions: 0,
          participants: 0,
        },
      });

      const result = await getMeetingDeletionImpact("meeting-empty");
      expect(result).toEqual({
        agendaItems: 0,
        decisions: 0,
        actions: 0,
        participants: 0,
      });
    });
  });

  describe("deleteMeetingPermanently", () => {
    it("MS-03: returns null when meeting does not exist", async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce(null);
      const result = await deleteMeetingPermanently("nonexistent");
      expect(result).toBeNull();
      expect(mockPrisma.meeting.delete).not.toHaveBeenCalled();
    });

    it("MS-04: calls prisma.meeting.delete when meeting exists", async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce({
        title: "Vorstandssitzung Q1",
        _count: { agendaItems: 2, decisions: 1, actions: 3, participants: 5 },
      });
      mockPrisma.meeting.delete.mockResolvedValueOnce({});

      await deleteMeetingPermanently("meeting-1");

      expect(mockPrisma.meeting.delete).toHaveBeenCalledWith({
        where: { id: "meeting-1" },
      });
    });

    it("MS-05: returns correct title and impact on success", async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce({
        title: "Jahreshauptversammlung",
        _count: { agendaItems: 5, decisions: 3, actions: 7, participants: 12 },
      });
      mockPrisma.meeting.delete.mockResolvedValueOnce({});

      const result = await deleteMeetingPermanently("meeting-2");

      expect(result).toEqual({
        meetingId: "meeting-2",
        title: "Jahreshauptversammlung",
        impact: {
          agendaItems: 5,
          decisions: 3,
          actions: 7,
          participants: 12,
        },
      });
    });
  });
});
