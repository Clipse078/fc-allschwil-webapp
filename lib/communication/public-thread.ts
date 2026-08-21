import type { CommunicationThreadRecord } from "@/lib/communication/thread-service";

/** Strips sensitive inbound routing token before API responses. */
export function toPublicCommunicationThread(thread: CommunicationThreadRecord) {
  const { inboundReplyToken, ...publicThread } = thread;
  void inboundReplyToken;
  return publicThread;
}
