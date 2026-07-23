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

import { evaluateForChannel } from "./publication-policy";
import type { PublicationChannel, PolicyEvent } from "./publication-policy";

// ── Event loader ───────────────────────────────────────────────────────────────

/**
 * A function that returns events for policy evaluation.
 * May be synchronous or asynchronous. Errors are propagated unchanged.
 */
export type EventLoader<T extends PolicyEvent> = () => T[] | Promise<T[]>;

// ── selectEventsForChannel ─────────────────────────────────────────────────────

/**
 * Returns all events from `loadEvents` that are eligible for the given
 * publication `channel`, preserving the loader's original ordering.
 *
 * Contract:
 * - `loadEvents` is called exactly once.
 * - Input events are never mutated.
 * - The original ordering of eligible events is preserved.
 * - Any error thrown by `loadEvents` is propagated to the caller.
 *
 * @param channel    The publication channel to evaluate events for.
 * @param loadEvents Injected event loader; called exactly once.
 * @returns          Promise resolving to eligible events in original order.
 */
export async function selectEventsForChannel<T extends PolicyEvent>(
  channel: PublicationChannel,
  loadEvents: EventLoader<T>,
): Promise<T[]> {
  const events = await loadEvents();
  return events.filter((event) => evaluateForChannel(event, channel).eligible);
}
