"use client";

/**
 * COMM-01C — Shared outbound email history and composer for registration-family drawers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunicationTargetType } from "@prisma/client";
import { AlertCircle, CheckCircle2, Clock3, Download, Loader2, Mail, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  MAX_EMAIL_BODY_LENGTH,
  MAX_EMAIL_SUBJECT_LENGTH,
} from "@/lib/communication/constants";
import type { PublicEmailThreadMessage } from "@/lib/communication/message-enrichment";
import type { CommunicationRecipient } from "@/lib/communication/recipient-resolver";
import { formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";
import { REGISTRATION_DRAWER_TAB_CONTENT_CLASS } from "@/components/admin/registrations/RegistrationDrawerTabShell";
import {
  EmailAttachmentComposer,
  formatAttachmentSize,
  type ComposerAttachment,
} from "@/components/admin/communications/EmailAttachmentComposer";
import {
  MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE,
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
  MAX_COMMUNICATION_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/communication/attachment-constants";

type Props = {
  tenantSlug: string;
  targetType: CommunicationTargetType;
  targetId: string;
  canEdit: boolean;
  lifecycleAllowsSend: boolean;
  locale?: string;
  timezone?: string;
  enabled?: boolean;
};

type ThreadResponse = { thread?: { id: string }; error?: string };
type HistoryResponse = {
  messages?: PublicEmailThreadMessage[];
  recipient?: CommunicationRecipient;
  error?: string;
};
type AttachmentUploadResponse = {
  attachment?: {
    attachmentId: string;
    filename: string;
    contentType: string;
    size: number;
    status: "READY";
    scanStatus: "PENDING" | "CLEAN";
  };
  error?: string;
};

const STATUS = {
  SENT: { label: "Gesendet", Icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Fehlgeschlagen", Icon: AlertCircle, className: "bg-rose-50 text-rose-700" },
  QUEUED: { label: "Wird gesendet", Icon: Clock3, className: "bg-amber-50 text-amber-700" },
  RECEIVED: { label: "Empfangen", Icon: Mail, className: "bg-slate-50 text-slate-700" },
} as const;

function EmailHistoryCard({
  message,
  locale,
  timezone,
  canRetry,
  retrying,
  showRetrySpinner,
  retryError,
  onRetry,
  tenantSlug,
}: {
  message: PublicEmailThreadMessage;
  locale: string;
  timezone: string;
  canRetry: boolean;
  retrying: boolean;
  showRetrySpinner: boolean;
  retryError: string | null;
  onRetry: (messageId: string) => void;
  tenantSlug: string;
}) {
  const status = STATUS[message.status];
  const { Icon } = status;
  const isInbound = message.direction === "INBOUND";
  const metaLine = isInbound ? `Von ${message.from ?? "-"}` : `An ${message.to ?? "-"}`;
  const timestamp =
    (isInbound ? message.receivedAt : message.sentAt) ?? message.createdAt;

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-[var(--foreground)]">
            {message.subject}
          </h3>
          <p className="mt-1 break-all text-[0.7rem] text-[var(--muted)]">
            {metaLine}
          </p>
        </div>
        <span className={cn("inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[0.65rem] font-semibold", status.className)}>
          <Icon className="h-3 w-3" aria-hidden />
          {status.label}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-2)]">
        {message.body}
      </p>
      {(message.attachments ?? []).length > 0 ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-semibold text-[var(--text-2)]">Anhänge</p>
          <ul className="mt-2 space-y-2">
            {(message.attachments ?? []).map((attachment) => (
              <li key={`${message.id}:${attachment.id}`} className="flex items-center gap-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[var(--text-2)]">
                  {attachment.filename} · {formatAttachmentSize(attachment.size)}
                </span>
                {attachment.downloadAvailable ? (
                  <a
                    href={`/api/tenants/${encodeURIComponent(tenantSlug)}/communications/attachments/${encodeURIComponent(attachment.id)}`}
                    className="inline-flex flex-shrink-0 items-center gap-1 font-semibold text-[var(--primary)] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Herunterladen
                  </a>
                ) : (
                  <span className="flex-shrink-0 text-[var(--muted)]">
                    Nur Metadaten verfügbar
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 border-t border-[var(--border)] pt-2 text-[0.7rem] text-[var(--muted)]">
        {formatDateTimeCompact(timestamp, { locale, timezone })}
        {!isInbound && message.senderDisplayName ? ` · ${message.senderDisplayName}` : ""}
        {message.attachmentCount ? ` · ${message.attachmentCount} Anhänge` : ""}
      </div>
      {message.status === "FAILED" ? (
        <>
          <p className="mt-2 text-xs text-rose-600">
            {message.deliveryError ?? "Die E-Mail konnte nicht gesendet werden."}
          </p>
          {canRetry && !isInbound ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                disabled={retrying}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {showRetrySpinner ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                Erneut senden
              </button>
              {retryError ? (
                <span className="text-xs text-rose-600">{retryError}</span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

export function EmailThreadTimeline({
  messages,
  locale,
  timezone,
  canRetryFailedOutbound,
  retryingMessageId,
  retryErrorMessageId,
  retryError,
  onRetry,
  tenantSlug,
}: {
  messages: PublicEmailThreadMessage[];
  locale: string;
  timezone: string;
  canRetryFailedOutbound: boolean;
  retryingMessageId: string | null;
  retryErrorMessageId: string | null;
  retryError: string | null;
  onRetry: (messageId: string) => void;
  tenantSlug: string;
}) {
  const retryLocked = retryingMessageId !== null;
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <EmailHistoryCard
          key={message.id}
          message={message}
          locale={locale}
          timezone={timezone}
          canRetry={canRetryFailedOutbound && message.direction === "OUTBOUND" && message.status === "FAILED"}
          retrying={retryLocked}
          showRetrySpinner={retryingMessageId === message.id}
          retryError={retryErrorMessageId === message.id ? retryError : null}
          onRetry={onRetry}
          tenantSlug={tenantSlug}
        />
      ))}
    </div>
  );
}

function EmailCommunicationPanelInner({
  tenantSlug,
  targetType,
  targetId,
  canEdit,
  lifecycleAllowsSend,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  enabled = true,
}: Props) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PublicEmailThreadMessage[] | null>(null);
  const [recipient, setRecipient] = useState<CommunicationRecipient | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryErrorMessageId, setRetryErrorMessageId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestGenerationRef = useRef(0);

  const loadHistory = useCallback(
    async (resolvedThreadId: string, generation: number) => {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads/${encodeURIComponent(resolvedThreadId)}/messages`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as HistoryResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "E-Mail-Verlauf konnte nicht geladen werden.");
      }
      if (!payload.recipient || (payload.recipient.available && !payload.recipient.email)) {
        throw new Error("E-Mail-Verlauf konnte nicht geladen werden.");
      }
      if (generation !== requestGenerationRef.current) return;
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setRecipient(payload.recipient);
    },
    [tenantSlug],
  );

  const initialize = useCallback(() => {
    const generation = ++requestGenerationRef.current;
    const query = `targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`;

    fetch(
      `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads?${query}`,
      { cache: "no-store" },
    )
      .then(async (existingResponse) => {
        // Clear error state once a new init attempt started.
        if (generation !== requestGenerationRef.current) return null;
        setLoadError(null);
        setSendError(null);

        let resolvedThreadId: string | null = null;
        if (existingResponse.ok) {
          const payload = (await existingResponse.json()) as ThreadResponse;
          resolvedThreadId = payload.thread?.id ?? null;
        } else if (existingResponse.status !== 404) {
          const payload = (await existingResponse.json()) as ThreadResponse;
          throw new Error(payload.error ?? "E-Mail-Kommunikation konnte nicht geladen werden.");
        }

        if (generation !== requestGenerationRef.current) return null;
        if (!resolvedThreadId && canEdit && lifecycleAllowsSend) {
          const createResponse = await fetch(
            `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetType, targetId }),
            },
          );
          const payload = (await createResponse.json()) as ThreadResponse;
          if (!createResponse.ok) {
            throw new Error(payload.error ?? "E-Mail-Kommunikation konnte nicht vorbereitet werden.");
          }
          resolvedThreadId = payload.thread?.id ?? null;
        }

        if (generation !== requestGenerationRef.current) return null;
        setThreadId(resolvedThreadId);
        if (resolvedThreadId) {
          await loadHistory(resolvedThreadId, generation);
        } else {
          setMessages([]);
          setRecipient(null);
        }

        return resolvedThreadId;
      })
      .catch((error) => {
        if (generation !== requestGenerationRef.current) return;
        setMessages(null);
        setRecipient(null);
        setLoadError(
          error instanceof Error ? error.message : "E-Mail-Verlauf konnte nicht geladen werden.",
        );
      });
  }, [canEdit, lifecycleAllowsSend, loadHistory, targetId, targetType, tenantSlug]);

  useEffect(() => {
    if (!enabled) return;
    void initialize();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [enabled, initialize]);

  useEffect(() => {
    if (messages?.length) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  const uploadAttachment = async (file: File, localId: string) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/attachments`,
        { method: "POST", body: formData },
      );
      const payload = (await response.json()) as AttachmentUploadResponse;
      if (!response.ok || !payload.attachment) {
        throw new Error(payload.error ?? "Upload fehlgeschlagen.");
      }
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.localId === localId
            ? {
                ...attachment,
                attachmentId: payload.attachment?.attachmentId ?? null,
                filename: payload.attachment?.filename ?? attachment.filename,
                contentType: payload.attachment?.contentType ?? attachment.contentType,
                size: payload.attachment?.size ?? attachment.size,
                status: "READY",
                error: undefined,
              }
            : attachment,
        ),
      );
    } catch (error) {
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.localId === localId
            ? {
                ...attachment,
                status: "ERROR",
                error: error instanceof Error ? error.message : "Upload fehlgeschlagen.",
              }
            : attachment,
        ),
      );
    }
  };

  const addAttachmentFiles = (files: File[]) => {
    if (files.length === 0) return;
    setAttachmentError(null);
    const next = [...attachments];
    const fingerprints = new Set(
      next.map((attachment) =>
        `${attachment.filename.toLowerCase()}:${attachment.size}:${attachment.contentType}`,
      ),
    );
    let projectedTotal = next.reduce((sum, attachment) => sum + attachment.size, 0);
    const uploads: Array<{ file: File; localId: string }> = [];
    let nextError: string | null = null;

    for (const file of files) {
      const fingerprint = `${file.name.toLowerCase()}:${file.size}:${file.type}`;
      if (fingerprints.has(fingerprint)) {
        nextError = "Diese Datei ist bereits ausgewählt.";
        continue;
      }
      if (next.length >= MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE) {
        nextError = "Eine Nachricht darf höchstens 10 Anhänge enthalten.";
        break;
      }
      if (file.size > MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES) {
        nextError = "Die Datei überschreitet 10 MiB.";
        continue;
      }
      if (projectedTotal + file.size > MAX_COMMUNICATION_ATTACHMENT_TOTAL_BYTES) {
        nextError = "Die Anhänge dürfen zusammen höchstens 20 MiB umfassen.";
        continue;
      }

      const localId =
        globalThis.crypto && "randomUUID" in globalThis.crypto
          ? `${globalThis.crypto.randomUUID()}-${next.length}`
          : `${Date.now()}-${Math.random()}`;
      next.push({
        localId,
        attachmentId: null,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        status: "UPLOADING",
      });
      fingerprints.add(fingerprint);
      projectedTotal += file.size;
      uploads.push({ file, localId });
    }

    setAttachments(next);
    setAttachmentError(nextError);
    for (const upload of uploads) {
      void uploadAttachment(upload.file, upload.localId);
    }
  };

  const submit = async () => {
    if (
      !threadId ||
      !recipient?.sendAllowed ||
      sending ||
      attachments.some((attachment) => attachment.status !== "READY")
    ) return;
    const generation = requestGenerationRef.current;
    const sendingThreadId = threadId;
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads/${encodeURIComponent(sendingThreadId)}/messages/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            bodyText,
            attachmentIds: attachments.flatMap((attachment) =>
              attachment.attachmentId ? [attachment.attachmentId] : [],
            ),
          }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Die E-Mail konnte nicht gesendet werden.");
      }
      if (generation !== requestGenerationRef.current) return;
      setSubject("");
      setBodyText("");
      setAttachments([]);
      setAttachmentError(null);
      await loadHistory(sendingThreadId, generation);
    } catch (sendError) {
      if (generation !== requestGenerationRef.current) return;
      setSendError(sendError instanceof Error ? sendError.message : "Die E-Mail konnte nicht gesendet werden.");
      await loadHistory(sendingThreadId, generation).catch(() => undefined);
    } finally {
      if (generation === requestGenerationRef.current) setSending(false);
    }
  };

  const canSend = canEdit && lifecycleAllowsSend && recipient?.sendAllowed === true;
  const canRetryFailedOutbound = canSend;
  const hasUnreadyAttachments = attachments.some(
    (attachment) => attachment.status !== "READY",
  );
  const disabledReason =
    recipient?.unavailableReason ??
    (!canEdit
      ? "Sie können den E-Mail-Verlauf ansehen, haben aber keine Berechtigung zum Senden."
      : !lifecycleAllowsSend
        ? "Dieser Eintrag ist abgeschlossen. Der E-Mail-Verlauf bleibt lesbar."
        : null);

  const retryFailed = async (messageId: string) => {
    if (!threadId || !canRetryFailedOutbound || retryingMessageId) return;
    const generation = requestGenerationRef.current;
    const resolvedThreadId = threadId;
    const idempotencyKey =
      globalThis.crypto && "randomUUID" in globalThis.crypto
        ? (globalThis.crypto as Crypto).randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setRetryingMessageId(messageId);
    setRetryError(null);
    setRetryErrorMessageId(null);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads/${encodeURIComponent(resolvedThreadId)}/messages/${encodeURIComponent(messageId)}/retry`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Die E-Mail konnte nicht erneut gesendet werden.");
      }
      if (generation !== requestGenerationRef.current) return;
      await loadHistory(resolvedThreadId, generation);
    } catch (error) {
      if (generation !== requestGenerationRef.current) return;
      setRetryErrorMessageId(messageId);
      setRetryError(
        error instanceof Error ? error.message : "Die E-Mail konnte nicht erneut gesendet werden.",
      );
      await loadHistory(resolvedThreadId, generation).catch(() => undefined);
    } finally {
      if (generation === requestGenerationRef.current) setRetryingMessageId(null);
    }
  };

  return (
    <div className={cn(REGISTRATION_DRAWER_TAB_CONTENT_CLASS, "flex min-h-[360px] flex-col")}>
      {enabled && !loadError && messages === null ? (
        <div className="flex flex-1 items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          E-Mails werden geladen…
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="h-5 w-5 text-rose-500" aria-hidden />
          <div>
            <p className="text-sm font-medium text-rose-600">{loadError}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Bitte versuche es erneut.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessages(null);
              setRecipient(null);
              setThreadId(null);
              setSubject("");
              setBodyText("");
              setAttachments([]);
              setAttachmentError(null);
              void initialize();
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            Erneut versuchen
          </button>
        </div>
      ) : (
        <>
          <section aria-label="E-Mail-Verlauf" className="flex-1">
            {messages && messages.length > 0 ? (
              <div>
                <EmailThreadTimeline
                  messages={messages}
                  locale={locale}
                  timezone={timezone}
                  canRetryFailedOutbound={canRetryFailedOutbound}
                  retryingMessageId={retryingMessageId}
                  retryErrorMessageId={retryErrorMessageId}
                  retryError={retryError}
                  onRetry={(id) => void retryFailed(id)}
                  tenantSlug={tenantSlug}
                />
                <div ref={endRef} />
              </div>
            ) : (
              <div className="flex min-h-[120px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center">
                <Mail className="mb-2 h-5 w-5 text-[var(--muted)]" aria-hidden />
                <p className="text-sm font-semibold text-[var(--foreground)]">Noch keine E-Mails.</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Die externe Kommunikation mit dieser Person erscheint hier.
                </p>
              </div>
            )}
          </section>

          {recipient ? (
            <section aria-label="E-Mail verfassen" className="mt-5 border-t border-[var(--border)] pt-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Neue E-Mail</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Direkt aus SportClubEvo senden</p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">An</span>
              <div className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-2)]">
                {recipient.available ? recipient.email : "Keine E-Mail-Adresse verfügbar"}
              </div>
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">Betreff</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={MAX_EMAIL_SUBJECT_LENGTH}
                disabled={!canSend || sending}
                className="fca-input w-full"
                placeholder="Betreff eingeben"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">Nachricht</span>
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                maxLength={MAX_EMAIL_BODY_LENGTH}
                disabled={!canSend || sending}
                rows={7}
                className="fca-textarea w-full resize-y"
                placeholder="Nachricht verfassen…"
              />
            </label>

            <EmailAttachmentComposer
              attachments={attachments}
              disabled={!canSend || sending}
              error={attachmentError}
              onAddFiles={addAttachmentFiles}
              onRemove={(localId) => {
                setAttachments((current) =>
                  current.filter((attachment) => attachment.localId !== localId),
                );
                setAttachmentError(null);
              }}
            />

            {disabledReason && !canSend ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                <span>{disabledReason}</span>
              </div>
            ) : null}
            {sendError ? <p className="mt-3 text-xs text-rose-600">{sendError}</p> : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={
                  !canSend ||
                  !subject.trim() ||
                  !bodyText.trim() ||
                  sending ||
                  hasUnreadyAttachments
                }
                className="fca-button-primary gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                {sending ? "Wird gesendet…" : "E-Mail senden"}
              </button>
            </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function EmailCommunicationPanel(props: Props) {
  const panelKey = `${props.tenantSlug}:${props.targetType}:${props.targetId}`;
  return <EmailCommunicationPanelInner key={panelKey} {...props} />;
}
