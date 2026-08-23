import { Resend } from "resend";
import {
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
} from "@/lib/communication/attachment-constants";
import type {
  InboundEmailAttachment,
  InboundEmailAttachmentRetriever,
  RetrievedInboundEmailAttachment,
} from "@/lib/communication/inbound-email-types";

export class ResendInboundAttachmentRetrievalError extends Error {
  constructor(
    readonly emailId: string,
    readonly attachmentId: string,
  ) {
    super("Resend inbound attachment retrieval failed.");
    this.name = "ResendInboundAttachmentRetrievalError";
  }
}

function requiredAttachmentId(
  emailId: string,
  attachment: InboundEmailAttachment,
): string {
  const id = attachment.id.trim();
  if (!id) {
    throw new ResendInboundAttachmentRetrievalError(emailId, id);
  }
  return id;
}

async function readResponseBytes(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!response.ok || !response.body) {
    throw new Error("Attachment download failed.");
  }
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)
  ) {
    throw new Error("Attachment download exceeds the size limit.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error("Attachment download exceeds the size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function createResendInboundAttachmentRetriever(input: {
  emailId: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): InboundEmailAttachmentRetriever {
  const emailId = input.emailId.trim();
  const apiKey =
    input.apiKey?.trim() ||
    process.env.RESEND_RECEIVING_API_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    "";
  const fetchImpl = input.fetchImpl ?? fetch;

  return async (
    attachment: InboundEmailAttachment,
  ): Promise<RetrievedInboundEmailAttachment> => {
    const attachmentId = requiredAttachmentId(emailId, attachment);
    if (!emailId || !apiKey) {
      throw new ResendInboundAttachmentRetrievalError(emailId, attachmentId);
    }

    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.receiving.attachments.get({
        emailId,
        id: attachmentId,
      });
      if (error || !data) throw new Error("Attachment metadata unavailable.");

      const filename = data.filename?.trim() ?? "";
      const contentType = data.content_type?.trim().toLowerCase() ?? "";
      if (
        data.id !== attachmentId ||
        !filename ||
        !contentType ||
        typeof data.size !== "number" ||
        !Number.isSafeInteger(data.size) ||
        data.size < 0
      ) {
        throw new Error("Attachment metadata unavailable.");
      }

      const downloadUrl = new URL(data.download_url);
      if (
        downloadUrl.protocol !== "https:" ||
        downloadUrl.username ||
        downloadUrl.password
      ) {
        throw new Error("Unsafe attachment download URL.");
      }
      const buffer = await readResponseBytes(
        await fetchImpl(downloadUrl, { redirect: "follow" }),
        MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
      );
      if (buffer.byteLength !== data.size) {
        throw new Error("Attachment size mismatch.");
      }
      return {
        providerAttachmentId: attachmentId,
        filename,
        contentType,
        sizeBytes: data.size,
        buffer,
      };
    } catch {
      throw new ResendInboundAttachmentRetrievalError(emailId, attachmentId);
    }
  };
}
