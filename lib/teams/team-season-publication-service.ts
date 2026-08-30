/**
 * Canonical, tenant-aware TeamSeason publication policy and persistence.
 *
 * Compatibility boundary (TEAM-CHANNEL-PUBLICATION-01B):
 * - Existing Website consumers intentionally continue reading legacy fields.
 *   The Website fallback master resolves Team.websiteVisible AND
 *   TeamSeason.websiteVisible, matching the current detail-page rule. The
 *   directory's Team-only rule is not silently changed in this slice.
 * - Existing Infoboard consumers intentionally do not call this service.
 *   INFOBOARD stores legacy Team/TeamSeason intention without becoming a new
 *   runtime gate.
 * - Master writes mirror the season-level legacy field only. Team-level master
 *   fields are not mutated because doing so would affect every season of the
 *   permanent Team. A later consumer-migration slice must deliberately resolve
 *   that duplicate ownership.
 */

import {
  TeamPublicationChannel,
  TeamPublicationContent,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const TEAM_PUBLICATION_CHANNELS = [
  TeamPublicationChannel.WEBSITE,
  TeamPublicationChannel.MOBILE_APP,
  TeamPublicationChannel.INFOBOARD,
] as const;

export const TEAM_PUBLICATION_CONTENT = [
  TeamPublicationContent.TRAINING_TIMES,
  TeamPublicationContent.NEXT_MATCH,
  TeamPublicationContent.NEXT_TOURNAMENT,
  TeamPublicationContent.TRAINER_TEAM,
  TeamPublicationContent.SQUAD,
  TeamPublicationContent.TEAM_PHOTO,
  TeamPublicationContent.STANDINGS,
] as const;

type LegacyPublicationState = {
  teamWebsiteVisible: boolean;
  teamInfoboardVisible: boolean;
  teamSeasonWebsiteVisible: boolean;
  teamSeasonInfoboardVisible: boolean;
  showNextMatch: boolean;
  showNextTournament: boolean;
  squadWebsiteVisible: boolean;
  trainerTeamWebsiteVisible: boolean;
};

type StoredChannel = {
  channel: TeamPublicationChannel;
  enabled: boolean;
};

type StoredContent = {
  channel: TeamPublicationChannel;
  content: TeamPublicationContent;
  enabled: boolean;
};

export type ResolvedTeamSeasonPublicationChannel = {
  enabled: boolean;
  content: Record<TeamPublicationContent, boolean>;
};

export type ResolvedTeamSeasonPublication = {
  channels: Record<
    TeamPublicationChannel,
    ResolvedTeamSeasonPublicationChannel
  >;
};

export type ResolveTeamSeasonPublicationResult =
  | { ok: true; publication: ResolvedTeamSeasonPublication }
  | { ok: false; code: "TEAM_SEASON_NOT_FOUND"; message: string };

function isPublicationChannel(value: unknown): value is TeamPublicationChannel {
  return TEAM_PUBLICATION_CHANNELS.includes(
    value as (typeof TEAM_PUBLICATION_CHANNELS)[number],
  );
}

function isPublicationContent(value: unknown): value is TeamPublicationContent {
  return TEAM_PUBLICATION_CONTENT.includes(
    value as (typeof TEAM_PUBLICATION_CONTENT)[number],
  );
}

/**
 * The one canonical default policy. Callers must resolve absent rows here
 * rather than defining channel-specific fallbacks of their own.
 */
export function defaultTeamSeasonChannelEnabled(
  channel: TeamPublicationChannel,
  legacy: LegacyPublicationState,
): boolean {
  switch (channel) {
    case TeamPublicationChannel.WEBSITE:
      return legacy.teamWebsiteVisible && legacy.teamSeasonWebsiteVisible;
    case TeamPublicationChannel.INFOBOARD:
      return legacy.teamInfoboardVisible && legacy.teamSeasonInfoboardVisible;
    case TeamPublicationChannel.MOBILE_APP:
      return false;
  }
}

export function defaultTeamSeasonContentEnabled(
  channel: TeamPublicationChannel,
  content: TeamPublicationContent,
  legacy: LegacyPublicationState,
): boolean {
  if (channel !== TeamPublicationChannel.WEBSITE) {
    // No legacy content semantics exist for Mobile or Infoboard. Absent rows
    // are explicitly ineligible until a channel-specific product policy exists.
    return false;
  }

  switch (content) {
    case TeamPublicationContent.TRAINING_TIMES:
      return true;
    case TeamPublicationContent.NEXT_MATCH:
      return legacy.showNextMatch;
    case TeamPublicationContent.NEXT_TOURNAMENT:
      return legacy.showNextTournament;
    case TeamPublicationContent.TRAINER_TEAM:
      return legacy.trainerTeamWebsiteVisible;
    case TeamPublicationContent.SQUAD:
      return legacy.squadWebsiteVisible;
    case TeamPublicationContent.TEAM_PHOTO:
      return false;
    case TeamPublicationContent.STANDINGS:
      return true;
  }
}

export function resolveTeamSeasonPublicationPolicy(
  legacy: LegacyPublicationState,
  storedChannels: readonly StoredChannel[] = [],
  storedContent: readonly StoredContent[] = [],
): ResolvedTeamSeasonPublication {
  const channelOverrides = new Map(
    storedChannels.map((setting) => [setting.channel, setting.enabled]),
  );
  const contentOverrides = new Map(
    storedContent.map((setting) => [
      `${setting.channel}:${setting.content}`,
      setting.enabled,
    ]),
  );

  const channels = {} as ResolvedTeamSeasonPublication["channels"];

  for (const channel of TEAM_PUBLICATION_CHANNELS) {
    const content = {} as Record<TeamPublicationContent, boolean>;
    for (const contentKey of TEAM_PUBLICATION_CONTENT) {
      content[contentKey] =
        contentOverrides.get(`${channel}:${contentKey}`) ??
        defaultTeamSeasonContentEnabled(channel, contentKey, legacy);
    }

    channels[channel] = {
      enabled:
        channelOverrides.get(channel) ??
        defaultTeamSeasonChannelEnabled(channel, legacy),
      content,
    };
  }

  return { channels };
}

const TEAM_SEASON_PUBLICATION_SELECT = {
  websiteVisible: true,
  infoboardVisible: true,
  showNextMatch: true,
  showNextTournament: true,
  squadWebsiteVisible: true,
  trainerTeamWebsiteVisible: true,
  team: {
    select: {
      websiteVisible: true,
      infoboardVisible: true,
    },
  },
  publicationChannels: {
    select: { channel: true, enabled: true },
  },
  publicationContents: {
    select: { channel: true, content: true, enabled: true },
  },
} as const;

export async function resolveTeamSeasonPublication(input: {
  tenantId: string;
  teamSeasonId: string;
}): Promise<ResolveTeamSeasonPublicationResult> {
  const teamSeason = await prisma.teamSeason.findFirst({
    where: {
      id: input.teamSeasonId,
      team: { tenantId: input.tenantId },
    },
    select: TEAM_SEASON_PUBLICATION_SELECT,
  });

  if (!teamSeason) {
    return {
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Team-Saison nicht gefunden.",
    };
  }

  return {
    ok: true,
    publication: resolveTeamSeasonPublicationPolicy(
      {
        teamWebsiteVisible: teamSeason.team.websiteVisible,
        teamInfoboardVisible: teamSeason.team.infoboardVisible,
        teamSeasonWebsiteVisible: teamSeason.websiteVisible,
        teamSeasonInfoboardVisible: teamSeason.infoboardVisible,
        showNextMatch: teamSeason.showNextMatch,
        showNextTournament: teamSeason.showNextTournament,
        squadWebsiteVisible: teamSeason.squadWebsiteVisible,
        trainerTeamWebsiteVisible: teamSeason.trainerTeamWebsiteVisible,
      },
      teamSeason.publicationChannels,
      teamSeason.publicationContents,
    ),
  };
}

export async function resolveTeamSeasonPublicationChannel(input: {
  tenantId: string;
  teamSeasonId: string;
  channel: TeamPublicationChannel;
}): Promise<
  | { ok: true; publication: ResolvedTeamSeasonPublicationChannel }
  | { ok: false; code: "INVALID_CHANNEL" | "TEAM_SEASON_NOT_FOUND"; message: string }
> {
  if (!isPublicationChannel(input.channel)) {
    return {
      ok: false,
      code: "INVALID_CHANNEL",
      message: "Ungültiger Veröffentlichungskanal.",
    };
  }

  const result = await resolveTeamSeasonPublication(input);
  if (!result.ok) return result;
  return { ok: true, publication: result.publication.channels[input.channel] };
}

export async function resolveTeamSeasonContentDecision(input: {
  tenantId: string;
  teamSeasonId: string;
  channel: TeamPublicationChannel;
  content: TeamPublicationContent;
}): Promise<
  | {
      ok: true;
      channelEnabled: boolean;
      contentEnabled: boolean;
      publishable: boolean;
    }
  | {
      ok: false;
      code: "INVALID_CHANNEL" | "INVALID_CONTENT" | "TEAM_SEASON_NOT_FOUND";
      message: string;
    }
> {
  if (!isPublicationChannel(input.channel)) {
    return {
      ok: false,
      code: "INVALID_CHANNEL",
      message: "Ungültiger Veröffentlichungskanal.",
    };
  }
  if (!isPublicationContent(input.content)) {
    return {
      ok: false,
      code: "INVALID_CONTENT",
      message: "Ungültiger Veröffentlichungsinhalt.",
    };
  }

  const result = await resolveTeamSeasonPublication(input);
  if (!result.ok) return result;

  const channel = result.publication.channels[input.channel];
  const contentEnabled = channel.content[input.content];
  return {
    ok: true,
    channelEnabled: channel.enabled,
    contentEnabled,
    publishable: channel.enabled && contentEnabled,
  };
}

/**
 * Aggregate Website publication never weakens an individual's deny control.
 * Existing status and other consumer-specific rules must still be applied by
 * the consumer in addition to this helper.
 */
export function isWebsiteMemberPublicationEligible(input: {
  channelEnabled: boolean;
  contentEnabled: boolean;
  memberWebsiteVisible: boolean;
}): boolean {
  return (
    input.channelEnabled &&
    input.contentEnabled &&
    input.memberWebsiteVisible
  );
}

export type UpdateTeamSeasonPublicationSettingsInput = {
  tenantId: string;
  teamSeasonId: string;
  channel: TeamPublicationChannel;
  /** Omitted means unchanged. */
  enabled?: boolean;
  /** Omitted keys mean unchanged; explicit false is persisted. */
  content?: Partial<Record<TeamPublicationContent, boolean>>;
};

export type UpdateTeamSeasonPublicationSettingsResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_CHANNEL"
        | "INVALID_CONTENT"
        | "INVALID_VALUE"
        | "NO_FIELDS_SUPPLIED"
        | "TEAM_SEASON_NOT_FOUND"
        | "UNKNOWN_ERROR";
      message: string;
    };

const WEBSITE_CONTENT_MIRRORS: Partial<
  Record<
    TeamPublicationContent,
    | "showNextMatch"
    | "showNextTournament"
    | "squadWebsiteVisible"
    | "trainerTeamWebsiteVisible"
  >
> = {
  [TeamPublicationContent.NEXT_MATCH]: "showNextMatch",
  [TeamPublicationContent.NEXT_TOURNAMENT]: "showNextTournament",
  [TeamPublicationContent.SQUAD]: "squadWebsiteVisible",
  [TeamPublicationContent.TRAINER_TEAM]: "trainerTeamWebsiteVisible",
};

/**
 * Transactional primitive for the future unified publication panel.
 *
 * All canonical upserts and applicable legacy TeamSeason mirrors commit or
 * roll back together. Team.websiteVisible/infoboardVisible are deliberately
 * untouched because those permanent-Team fields span multiple TeamSeasons.
 */
export async function updateTeamSeasonPublicationSettings(
  input: UpdateTeamSeasonPublicationSettingsInput,
): Promise<UpdateTeamSeasonPublicationSettingsResult> {
  if (!isPublicationChannel(input.channel)) {
    return {
      ok: false,
      code: "INVALID_CHANNEL",
      message: "Ungültiger Veröffentlichungskanal.",
    };
  }
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
    return {
      ok: false,
      code: "INVALID_VALUE",
      message: "enabled muss ein Boolean sein.",
    };
  }

  const contentEntries = Object.entries(input.content ?? {});
  for (const [content, enabled] of contentEntries) {
    if (!isPublicationContent(content)) {
      return {
        ok: false,
        code: "INVALID_CONTENT",
        message: `Ungültiger Veröffentlichungsinhalt: ${content}.`,
      };
    }
    if (typeof enabled !== "boolean") {
      return {
        ok: false,
        code: "INVALID_VALUE",
        message: `${content} muss ein Boolean sein.`,
      };
    }
  }

  if (input.enabled === undefined && contentEntries.length === 0) {
    return {
      ok: false,
      code: "NO_FIELDS_SUPPLIED",
      message: "Mindestens eine Veröffentlichungseinstellung ist erforderlich.",
    };
  }

  const teamSeason = await prisma.teamSeason.findFirst({
    where: {
      id: input.teamSeasonId,
      team: { tenantId: input.tenantId },
    },
    select: { id: true },
  });
  if (!teamSeason) {
    return {
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Team-Saison nicht gefunden.",
    };
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const legacyTeamSeasonData: Prisma.TeamSeasonUpdateInput = {};

      if (input.enabled !== undefined) {
        await tx.teamSeasonPublicationChannel.upsert({
          where: {
            teamSeasonId_channel: {
              teamSeasonId: input.teamSeasonId,
              channel: input.channel,
            },
          },
          create: {
            teamSeasonId: input.teamSeasonId,
            channel: input.channel,
            enabled: input.enabled,
          },
          update: { enabled: input.enabled },
        });

        if (input.channel === TeamPublicationChannel.WEBSITE) {
          legacyTeamSeasonData.websiteVisible = input.enabled;
        } else if (input.channel === TeamPublicationChannel.INFOBOARD) {
          legacyTeamSeasonData.infoboardVisible = input.enabled;
        }
      }

      for (const [content, enabled] of contentEntries as Array<
        [TeamPublicationContent, boolean]
      >) {
        await tx.teamSeasonPublicationContent.upsert({
          where: {
            teamSeasonId_channel_content: {
              teamSeasonId: input.teamSeasonId,
              channel: input.channel,
              content,
            },
          },
          create: {
            teamSeasonId: input.teamSeasonId,
            channel: input.channel,
            content,
            enabled,
          },
          update: { enabled },
        });

        if (input.channel === TeamPublicationChannel.WEBSITE) {
          const legacyField = WEBSITE_CONTENT_MIRRORS[content];
          if (legacyField) legacyTeamSeasonData[legacyField] = enabled;
        }
      }

      if (Object.keys(legacyTeamSeasonData).length > 0) {
        await tx.teamSeason.update({
          where: { id: input.teamSeasonId },
          data: legacyTeamSeasonData,
        });
      }
    });
  } catch (error) {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Veröffentlichungseinstellungen konnten nicht gespeichert werden.",
    };
  }

  return { ok: true };
}
