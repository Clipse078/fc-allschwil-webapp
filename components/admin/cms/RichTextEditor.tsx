"use client";

/**
 * components/admin/cms/RichTextEditor.tsx
 *
 * Premium rich text editor for CMS block authoring.
 * Built on TipTap/ProseMirror. Stores content as structured JSON (RichTextValue)
 * — never raw HTML — making it safe for public rendering via richTextToHtml().
 *
 * Supported formats: paragraphs, headings (H2/H3), bold, italic, links,
 * bullet lists, ordered lists, blockquotes, line breaks, clear formatting.
 */

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link2,
  Link2Off,
  Heading2,
  Heading3,
  Minus,
  Eraser,
} from "lucide-react";
import type { RichTextValue } from "@/lib/cms/rich-text";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type RichTextEditorProps = {
  value: RichTextValue | null | undefined;
  onChange: (value: RichTextValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded transition
        ${active ? "bg-[var(--brand-primary,#f97316)] text-white" : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"}
        ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function EditorToolbar({ editor }: { editor: Editor }) {
  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Überschrift 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Überschrift 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--border)]" />

      {/* Inline marks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Fett"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Kursiv"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={addLink}
        active={editor.isActive("link")}
        title="Link setzen"
      >
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
        title="Link entfernen"
      >
        <Link2Off className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--border)]" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Aufzählung"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Nummerierte Liste"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Zitat"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--border)]" />

      {/* Utilities */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHardBreak().run()}
        title="Zeilenumbruch"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Formatierung entfernen"
      >
        <Eraser className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Editor
// ---------------------------------------------------------------------------

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Text eingeben…",
  disabled = false,
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable: !disabled,
    onUpdate({ editor: ed }) {
      const json = ed.getJSON() as RichTextValue;
      onChange(json);
    },
  });

  // Sync external value changes (e.g. on restore from revision)
  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const nextJson = JSON.stringify(value ?? { type: "doc", content: [{ type: "paragraph" }] });
    if (currentJson !== nextJson) {
      editor.commands.setContent(
        value ?? { type: "doc", content: [{ type: "paragraph" }] },
      );
    }
  }, [editor, value]);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] ${disabled ? "opacity-60" : ""} ${className}`}
    >
      {editor && !disabled && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 text-sm text-[var(--foreground)] focus-within:outline-none [&_.ProseMirror]:min-h-[80px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[var(--muted)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
