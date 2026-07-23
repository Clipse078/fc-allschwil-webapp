/**
 * lib/publishing/policy/event-selection.ts
 *
 * Event selection service for a publication channel.
 *
 * Decouples the policy layer from any persistence concern by accepting an
 * injected event loader. The loader is called exactly once per invocation.
 *
 * No Prisma, no routes, no UI, no schema changes.
 */

import { evaluatePublication } from "./publication-policy";
import type {
  PublicationChannel,
  PublicationPolicyEvent,
  PublicationDecision,
} from "./publication-policy";

// ── Event loader ───────────────────────────────────────────────────────────────

export type PublicationEventLoadInput = {
  tenantId: string;
  dateFrom?: Date;
  dateTo?: Date;
  seasonKey?: string;
  teamSlug?: string;
};

export type PublicationEventLoader<TEvent> = (
  input: PublicationEventLoadInput,
) => Promise<readonly TEvent[]>;

// ── Selection input ────────────────────────────────────────────────────────────

export type SelectEventsForPublicationInput = {
  tenantId: string;
  channel: PublicationChannel;
  dateFrom?: Date;
  dateTo?: Date;
  seasonKey?: string;
  teamSlug?: string;
};

// ── Selection result ───────────────────────────────────────────────────────────

export type RejectedPublicationEvent<TEvent> = {
  event: TEvent;
  decision: PublicationDecision;
};

export type PublicationSelectionResult<TEvent> = {
  eligible: TEvent[];
  rejected: RejectedPublicationEvent<TEvent>[];
};

// ── selectEventsForPublication ─────────────────────────────────────────────────

/**
 * Loads events via `loadEvents` and partitions them into eligible and rejected
 * sets for the given publication channel.
 *
 * Contract:
 * - `loadEvents` is called exactly once.
 * - The channel is not forwarded to the loader.
 * - Input events are never mutated.
 * - The original ordering within each partition is preserved.
 * - Rejection decisions are exact `PublicationDecision` values.
 * - New arrays are returned; no mutation occurs.
 * - Any error thrown by `loadEvents` is propagated to the caller.
 * - No date-filtering or temporal grouping is applied.
 */
export async function selectEventsForPublication<
  TEvent extends PublicationPolicyEvent,
>(
  loadEvents: PublicationEventLoader<TEvent>,
  input: SelectEventsForPublicationInput,
): Promise<PublicationSelectionResult<TEvent>> {
  const { channel, tenantId, ...loaderInput } = input;

  const events = await loadEvents({ tenantId, ...loaderInput });

  const eligible: TEvent[] = [];
  const rejected: RejectedPublicationEvent<TEvent>[] = [];

  for (const event of events) {
    const decision = evaluatePublication(event, channel, tenantId);
    if (decision.eligible) {
      eligible.push(event);
    } else {
      rejected.push({ event, decision });
    }
  }

  return { eligible, rejected };
}
