"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from "lucide-react";

interface RichTextEditorProps {
  onChange: (html: string) => void;
  /**
   * When set, the editor exposes an Image button in the toolbar. Uploaded
   * images are POSTed with this draftId so they can be re-linked to the
   * broadcast on send/schedule.
   */
  draftId?: string;
}

export function RichTextEditor({ onChange, draftId }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      // The send pipeline rewrites src → cid:att-{id} using data-att-id,
      // so it must round-trip through the HTML.
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            "data-att-id": {
              default: null,
              parseHTML: (el) => el.getAttribute("data-att-id"),
              renderHTML: (attrs) =>
                attrs["data-att-id"]
                  ? { "data-att-id": attrs["data-att-id"] as string }
                  : {},
            },
          };
        },
      }).configure({ inline: false }),
    ],
    content: "",
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  async function handleImageFile(file: File) {
    if (!editor || !draftId) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("draftId", draftId);
      fd.append("isInline", "true");
      const res = await fetch("/api/admin/broadcast-attachments", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const { id, previewUrl } = (await res.json()) as {
        id: string;
        previewUrl: string;
      };
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            src: previewUrl,
            alt: file.name,
            "data-att-id": id,
          },
        })
        .run();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  const btnClass = (active: boolean) =>
    `rounded p-1.5 ${active ? "bg-green-100 text-green-800" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap gap-1 border-b bg-gray-50 p-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive("underline"))}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300" />

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={btnClass(editor.isActive("heading", { level: 1 }))}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={btnClass(editor.isActive("heading", { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300" />

        <button
          type="button"
          onClick={toggleLink}
          className={btnClass(editor.isActive("link"))}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>

        {draftId && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImageFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`${btnClass(false)} disabled:opacity-30`}
              title={uploading ? "Uploading…" : "Insert image"}
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </>
        )}

        <div className="mx-1 w-px bg-gray-300" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${btnClass(false)} disabled:opacity-30`}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${btnClass(false)} disabled:opacity-30`}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>
      </div>

      <EditorContent editor={editor} className="tiptap-editor" />
      {uploadError && (
        <p className="border-t border-gray-200 px-3 py-2 text-xs text-red-600">
          {uploadError}
        </p>
      )}
    </div>
  );
}
