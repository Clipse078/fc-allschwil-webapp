-- COMM-01C: retain a safe, auditable summary when outbound delivery fails.
ALTER TABLE "CommunicationMessage"
ADD COLUMN "deliveryError" TEXT;
