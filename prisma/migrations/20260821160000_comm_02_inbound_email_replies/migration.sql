-- COMM-02 — inbound email replies foundation
-- Adds provider-idempotency fields and normalized attachment metadata to CommunicationMessage.

ALTER TABLE "CommunicationMessage" ADD COLUMN     "providerEventId" TEXT;
ALTER TABLE "CommunicationMessage" ADD COLUMN     "replyToAddress" TEXT;
ALTER TABLE "CommunicationMessage" ADD COLUMN     "attachments" JSONB;

CREATE UNIQUE INDEX "CommunicationMessage_provider_providerMessageId_key"
ON "CommunicationMessage"("provider", "providerMessageId");

CREATE UNIQUE INDEX "CommunicationMessage_provider_providerEventId_key"
ON "CommunicationMessage"("provider", "providerEventId");

CREATE INDEX "CommunicationMessage_provider_providerMessageId_idx"
ON "CommunicationMessage"("provider", "providerMessageId");

CREATE INDEX "CommunicationMessage_provider_providerEventId_idx"
ON "CommunicationMessage"("provider", "providerEventId");
