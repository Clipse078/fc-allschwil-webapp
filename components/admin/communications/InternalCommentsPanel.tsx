"use client";

/**
 * COMM-01B — Shared internal comments workspace for registration lifecycle drawers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, MessageSquare, MoreHorizontal } from "lucide-react";
import type { CommunicationTargetType } from "@prisma/client";
import { cn } from "@/lib/cn";
import { formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";
import type { EnrichedInternalComment } from "@/lib/communication/comment-enrichment";
import { REGISTRATION_DRAWER_TAB_CONTENT_CLASS } from "@/components/admin/registrations/RegistrationDrawerTabShell";
import { CoordinatorAvatar } from "@/components/admin/registrations/WaitingListCoordinatorPicker";
import { CommentBody } from "./CommentBody";
import { InternalCommentComposer } from "./InternalCommentComposer";

type Props = {
  tenantSlug: string;
  targetType: CommunicationTargetType;
  targetId: string;
  canEdit: boolean;
  currentUserId: string | null;
  locale?: string;
  timezone?: string;
  enabled?: boolean;
};

type ThreadResponse = { thread?: { id: string } };
type CommentsResponse = { comments?: EnrichedInternalComment[] };
type CommentResponse = { comment?: EnrichedInternalComment };

function CommentActionsMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        aria-label="Kommentar-Aktionen"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[80] mt-1 min-w-[140px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="block w-full px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Löschen
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  currentUserId,
  locale,
  timezone,
  onEdit,
  onDelete,
}: {
  comment: EnrichedInternalComment;
  canEdit: boolean;
  currentUserId: string | null;
  locale: string;
  timezone: string;
  onEdit: (comment: EnrichedInternalComment) => void;
  onDelete: (comment: EnrichedInternalComment) => void;
}) {
  const isAuthor = !!currentUserId && comment.authorUserId === currentUserId;
  const showActions = canEdit && isAuthor && !comment.isDeleted;

  return (
    <article className="border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <CoordinatorAvatar name={comment.authorDisplayName} compact />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                {comment.authorDisplayName}
              </p>
              <p className="text-[0.7rem] text-[var(--muted)]">
                {formatDateTimeCompact(comment.createdAt, { locale, timezone })}
                {comment.isEdited ? " · bearbeitet" : ""}
              </p>
            </div>
            {showActions ? (
              <CommentActionsMenu
                onEdit={() => onEdit(comment)}
                onDelete={() => onDelete(comment)}
              />
            ) : null}
          </div>

          <div className="mt-2">
            {comment.isDeleted ? (
              <p className="text-sm italic text-[var(--muted)]">Kommentar gelöscht</p>
            ) : (
              <CommentBody body={comment.body ?? ""} mentions={comment.mentions} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function InternalCommentsPanel({
  tenantSlug,
  targetType,
  targetId,
  canEdit,
  currentUserId,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  enabled = true,
}: Props) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [comments, setComments] = useState<EnrichedInternalComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<EnrichedInternalComment | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(
    async (resolvedThreadId: string) => {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads/${encodeURIComponent(resolvedThreadId)}/comments`,
        { cache: "no-store" },
      );
      const payload = (await res.json()) as CommentsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Kommentare konnten nicht geladen werden.");
      }
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
    },
    [tenantSlug],
  );

  const ensureThreadAndLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const getRes = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
        { cache: "no-store" },
      );

      let resolvedThreadId: string | null = null;

      if (getRes.ok) {
        const getPayload = (await getRes.json()) as ThreadResponse;
        resolvedThreadId = getPayload.thread?.id ?? null;
      }

      if (!resolvedThreadId && canEdit) {
        const postRes = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetType, targetId }),
          },
        );
        const postPayload = (await postRes.json()) as ThreadResponse & { error?: string };
        if (!postRes.ok) {
          throw new Error(postPayload.error ?? "Thread konnte nicht erstellt werden.");
        }
        resolvedThreadId = postPayload.thread?.id ?? null;
      }

      if (!resolvedThreadId) {
        setThreadId(null);
        setComments([]);
        return;
      }

      setThreadId(resolvedThreadId);
      await loadComments(resolvedThreadId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kommentare konnten nicht geladen werden.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [canEdit, loadComments, targetId, targetType, tenantSlug]);

  useEffect(() => {
    if (!enabled) return;
    setComments(null);
    setThreadId(null);
    setEditingComment(null);
    void ensureThreadAndLoad();
  }, [enabled, ensureThreadAndLoad, targetId, targetType]);

  useEffect(() => {
    if (!comments?.length) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [comments?.length]);

  const mutateComment = async (
    method: "POST" | "PATCH" | "DELETE",
    payload?: { body: string; mentionedUserIds: string[] },
    commentId?: string,
  ) => {
    if (!threadId) return;

    const url =
      method === "POST"
        ? `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads/${encodeURIComponent(threadId)}/comments`
        : `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/threads/${encodeURIComponent(threadId)}/comments/${encodeURIComponent(commentId ?? "")}`;

    const res = await fetch(url, {
      method,
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body:
        method === "DELETE"
          ? undefined
          : JSON.stringify({
              body: payload?.body,
              mentionedUserIds: payload?.mentionedUserIds ?? [],
            }),
    });

    const responsePayload = (await res.json()) as (CommentsResponse | CommentResponse) & {
      error?: string;
    };

    if (!res.ok) {
      throw new Error(responsePayload.error ?? "Kommentar konnte nicht gespeichert werden.");
    }

    await loadComments(threadId);

    if (method !== "DELETE" && "comment" in responsePayload && responsePayload.comment) {
      setEditingComment(null);
    }
  };

  return (
    <div className={cn(REGISTRATION_DRAWER_TAB_CONTENT_CLASS, "flex min-h-[280px] flex-col")}>
      <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
        <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" aria-hidden />
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Nur intern
          </p>
          <p className="text-xs text-[var(--text-2)]">
            Interne Kommentare sind nur für berechtigte Vereinsnutzer sichtbar.
          </p>
        </div>
      </div>

      {loading && !comments ? (
        <div className="flex flex-1 items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Wird geladen…
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void ensureThreadAndLoad()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)]"
          >
            Erneut versuchen
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1">
            {comments && comments.length > 0 ? (
              <div>
                {comments.map((comment) =>
                  editingComment?.id === comment.id ? (
                    <div key={comment.id} className="border-b border-[var(--border)] py-4">
                      <InternalCommentComposer
                        tenantSlug={tenantSlug}
                        initialBody={comment.body ?? ""}
                        initialMentionedUserIds={comment.mentions.map((mention) => mention.mentionedUserId)}
                        submitLabel="Speichern"
                        onCancel={() => setEditingComment(null)}
                        onSubmit={async (payload) => {
                          await mutateComment("PATCH", payload, comment.id);
                        }}
                      />
                    </div>
                  ) : (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      canEdit={canEdit}
                      currentUserId={currentUserId}
                      locale={locale}
                      timezone={timezone}
                      onEdit={setEditingComment}
                      onDelete={async (target) => {
                        await mutateComment("DELETE", undefined, target.id);
                      }}
                    />
                  ),
                )}
                <div ref={listEndRef} />
              </div>
            ) : (
              <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
                <MessageSquare className="mb-2 h-5 w-5 text-[var(--muted)]" aria-hidden />
                <p className="text-sm text-[var(--muted)]">Noch keine internen Kommentare.</p>
              </div>
            )}
          </div>

          {canEdit && threadId && !editingComment ? (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <InternalCommentComposer
                tenantSlug={tenantSlug}
                disabled={!threadId}
                onSubmit={async (payload) => {
                  await mutateComment("POST", payload);
                }}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
