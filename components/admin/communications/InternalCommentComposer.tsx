"use client";

/**
 * COMM-01B — Multiline internal comment composer with @mention autocomplete.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { PopoverContent } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import { MAX_INTERNAL_COMMENT_BODY_LENGTH } from "@/lib/communication/constants";
import { CoordinatorAvatar } from "@/components/admin/registrations/WaitingListCoordinatorPicker";
import type { AssignableUser } from "@/lib/registrations/workflow-types";

type MentionContext = {
  start: number;
  query: string;
};

type Props = {
  tenantSlug: string;
  disabled?: boolean;
  submitLabel?: string;
  placeholder?: string;
  initialBody?: string;
  initialMentionedUserIds?: string[];
  onSubmit: (payload: { body: string; mentionedUserIds: string[] }) => Promise<void>;
  onCancel?: () => void;
};

function detectMentionContext(text: string, cursor: number): MentionContext | null {
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return null;

  const charBeforeAt = atIndex > 0 ? beforeCursor[atIndex - 1] : " ";
  if (charBeforeAt !== " " && charBeforeAt !== "\n" && atIndex !== 0) {
    return null;
  }

  const query = beforeCursor.slice(atIndex + 1);
  if (query.includes("\n")) return null;

  return { start: atIndex, query };
}

export function InternalCommentComposer({
  tenantSlug,
  disabled = false,
  submitLabel = "Kommentieren",
  placeholder = "Kommentar hinzufügen…",
  initialBody = "",
  initialMentionedUserIds = [],
  onSubmit,
  onCancel,
}: Props) {
  const instanceId = useId();
  const listboxId = `mention-listbox-${instanceId}`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [body, setBody] = useState(initialBody);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(initialMentionedUserIds);
  const [submitting, setSubmitting] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<AssignableUser[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmedBody = body.trim();
  const canSubmit = !disabled && !submitting && trimmedBody.length > 0;

  const listActiveIndex =
    candidates.length === 0 ? -1 : Math.min(Math.max(activeIndex, 0), candidates.length - 1);

  const fetchCandidates = useCallback(
    async (query: string) => {
      setCandidatesLoading(true);
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/communications/mention-candidates?q=${encodeURIComponent(query)}`,
          { cache: "no-store" },
        );
        const payload = await res.json();
        setCandidates(res.ok && Array.isArray(payload.candidates) ? payload.candidates : []);
      } catch {
        setCandidates([]);
      } finally {
        setCandidatesLoading(false);
      }
    },
    [tenantSlug],
  );

  useEffect(() => {
    if (!mentionOpen) return;
    const handle = window.setTimeout(() => {
      void fetchCandidates(mentionQuery);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [fetchCandidates, mentionOpen, mentionQuery]);

  const updateMentionState = (nextBody: string, cursor: number) => {
    const context = detectMentionContext(nextBody, cursor);
    if (!context) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(context.query);
    setMentionStart(context.start);
    setActiveIndex(0);
  };

  const insertMention = (user: AssignableUser) => {
    if (mentionStart === null) return;
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? body.length;
    const label = `${user.firstName} ${user.lastName}`.trim();
    const before = body.slice(0, mentionStart);
    const after = body.slice(cursor);
    const nextBody = `${before}@${label} ${after}`;
    setBody(nextBody.slice(0, MAX_INTERNAL_COMMENT_BODY_LENGTH));
    setMentionedUserIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);

    requestAnimationFrame(() => {
      const nextCursor = `${before}@${label} `.length;
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ body: trimmedBody, mentionedUserIds });
      if (!onCancel) {
        setBody("");
        setMentionedUserIds([]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCandidates = useMemo(() => candidates, [candidates]);

  return (
    <div ref={anchorRef} className="relative">
      <textarea
        ref={textareaRef}
        value={body}
        disabled={disabled || submitting}
        rows={3}
        maxLength={MAX_INTERNAL_COMMENT_BODY_LENGTH}
        placeholder={placeholder}
        onChange={(event) => {
          const nextBody = event.target.value;
          setBody(nextBody);
          updateMentionState(nextBody, event.target.selectionStart);
        }}
        onClick={(event) => {
          updateMentionState(body, event.currentTarget.selectionStart);
        }}
        onKeyUp={(event) => {
          updateMentionState(body, event.currentTarget.selectionStart);
        }}
        onKeyDown={(event) => {
          if (mentionOpen && filteredCandidates.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((prev) => Math.min(prev + 1, filteredCandidates.length - 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, 0));
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && listActiveIndex >= 0) {
              event.preventDefault();
              insertMention(filteredCandidates[listActiveIndex]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setMentionOpen(false);
              return;
            }
          }

          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        className={cn(
          "w-full resize-none rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]/20",
          disabled && "opacity-60",
        )}
      />

      <PopoverContent
        open={mentionOpen && (filteredCandidates.length > 0 || candidatesLoading)}
        onOpenChange={setMentionOpen}
        anchorRef={anchorRef}
        id={listboxId}
        matchAnchorWidth={false}
        maxHeight={240}
        className="min-w-[260px]"
      >
        {candidatesLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Suche…
          </div>
        ) : (
          <ul role="listbox" className="py-0">
            {filteredCandidates.map((user, index) => {
              const label = `${user.firstName} ${user.lastName}`.trim();
              return (
                <li key={user.id} role="option" aria-selected={index === listActiveIndex}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertMention(user);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]",
                      index === listActiveIndex && "bg-[var(--surface-2)]",
                    )}
                  >
                    <CoordinatorAvatar name={label} compact />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{label}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>

      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Abbrechen
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tenant-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
