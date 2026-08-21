/**
 * lib/communication/mention-notifications.ts
 *
 * COMM-01B: Hook for future in-app / email mention notifications.
 * Delivery is intentionally deferred — no notification infrastructure wired yet.
 */

export type CommentMentionNotificationInput = {
  tenantId: string;
  threadId: string;
  commentId: string;
  mentionedUserId: string;
  authorUserId: string;
};

/**
 * Called after a comment with mentions is successfully persisted.
 * Currently a no-op — integrate with notification service in a future slice.
 */
export async function notifyCommentMentions(
  inputs: CommentMentionNotificationInput[],
): Promise<void> {
  void inputs;
}
