/**
 * lib/cms/rich-text.ts
 *
 * Shared rich text type definitions and safe-rendering helpers for the CMS.
 *
 * Storage format: TipTap/ProseMirror JSON document.
 * This is a structured format — not raw HTML — making it safe for serialisation
 * and storage without sanitisation concerns at the authoring layer.
 *
 * Public rendering must go through richTextToHtml() which produces safe,
 * allowed-tag HTML that website consumers can render.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single inline mark (bold, italic, link, etc.). */
export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string; target?: string | null; rel?: string | null } };

/** A leaf text node. */
export type RichTextTextNode = {
  type: "text";
  text: string;
  marks?: RichTextMark[];
};

/** Structural block node types. */
export type RichTextBlockNode =
  | { type: "paragraph"; content?: RichTextInlineNode[] }
  | { type: "heading"; attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 }; content?: RichTextInlineNode[] }
  | { type: "bulletList"; content?: RichTextListItemNode[] }
  | { type: "orderedList"; content?: RichTextListItemNode[] }
  | { type: "listItem"; content?: RichTextBlockNode[] }
  | { type: "blockquote"; content?: RichTextBlockNode[] }
  | { type: "hardBreak" };

export type RichTextListItemNode = {
  type: "listItem";
  content?: RichTextBlockNode[];
};

export type RichTextInlineNode = RichTextTextNode | { type: "hardBreak" };

/** Root document node. */
export type RichTextValue = {
  type: "doc";
  content: RichTextBlockNode[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if value is a non-empty RichTextValue document. */
export function isRichTextValue(value: unknown): value is RichTextValue {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).type === "doc" &&
    Array.isArray((value as Record<string, unknown>).content)
  );
}

/** Returns true if a rich text document has meaningful text content. */
export function richTextHasContent(value: RichTextValue | null | undefined): boolean {
  if (!value) return false;
  if (!isRichTextValue(value)) return false;
  return value.content.some((node) => {
    if ("content" in node && Array.isArray(node.content)) {
      return node.content.some(
        (child) => "text" in child && typeof child.text === "string" && child.text.trim() !== "",
      );
    }
    return false;
  });
}

/** Creates an empty rich text document. */
export function emptyRichText(): RichTextValue {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * Converts a RichTextValue document to safe HTML for public rendering.
 *
 * Only allows: p, h1-h6, ul, ol, li, blockquote, strong, em, a, br.
 * All other tags are stripped. Link hrefs must start with http(s):// or /.
 *
 * NOTE: This runs server-side only (no DOM access). Output is safe for
 * insertion into public website HTML.
 */
export function richTextToHtml(value: RichTextValue | null | undefined): string {
  if (!isRichTextValue(value)) return "";
  return value.content.map(blockToHtml).join("");
}

function blockToHtml(node: RichTextBlockNode): string {
  switch (node.type) {
    case "paragraph": {
      const inner = inlinesToHtml(node.content ?? []);
      return inner ? `<p>${inner}</p>` : "<p></p>";
    }
    case "heading": {
      const level = node.attrs?.level ?? 2;
      const tag = `h${Math.min(6, Math.max(1, level))}`;
      return `<${tag}>${inlinesToHtml(node.content ?? [])}</${tag}>`;
    }
    case "bulletList": {
      const items = (node.content ?? []).map(listItemToHtml).join("");
      return `<ul>${items}</ul>`;
    }
    case "orderedList": {
      const items = (node.content ?? []).map(listItemToHtml).join("");
      return `<ol>${items}</ol>`;
    }
    case "listItem": {
      const inner = (node.content ?? []).map(blockToHtml).join("");
      return `<li>${inner}</li>`;
    }
    case "blockquote": {
      const inner = (node.content ?? []).map(blockToHtml).join("");
      return `<blockquote>${inner}</blockquote>`;
    }
    case "hardBreak":
      return "<br />";
    default:
      return "";
  }
}

function listItemToHtml(node: RichTextListItemNode): string {
  const inner = (node.content ?? []).map(blockToHtml).join("");
  return `<li>${inner}</li>`;
}

function inlinesToHtml(nodes: RichTextInlineNode[]): string {
  return nodes.map(inlineToHtml).join("");
}

function inlineToHtml(node: RichTextInlineNode): string {
  if (node.type === "hardBreak") return "<br />";
  if (node.type !== "text") return "";
  const text = escapeHtml(node.text ?? "");
  if (!node.marks || node.marks.length === 0) return text;

  let result = text;
  for (const mark of node.marks) {
    switch (mark.type) {
      case "bold":
        result = `<strong>${result}</strong>`;
        break;
      case "italic":
        result = `<em>${result}</em>`;
        break;
      case "link": {
        const href = sanitiseHref(mark.attrs?.href ?? "");
        if (href) {
          const target = mark.attrs?.target ? ` target="${escapeHtml(mark.attrs.target)}"` : "";
          const rel = mark.attrs?.target === "_blank" ? ' rel="noopener noreferrer"' : "";
          result = `<a href="${href}"${target}${rel}>${result}</a>`;
        }
        break;
      }
    }
  }
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitiseHref(href: string): string {
  if (!href) return "";
  const trimmed = href.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) {
    return escapeHtml(trimmed);
  }
  return "";
}
