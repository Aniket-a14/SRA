"use client";

import { useEffect } from "react";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useTheme } from "next-themes";

interface EditorProps {
    initialContent?: string;
    onChange?: (markdown: string) => void;
    editable?: boolean;
    className?: string; // Add className prop support
}

export default function Editor({ initialContent = "", onChange, editable = true, className }: EditorProps) {
    const { theme } = useTheme();

    // We use a state to track if the editor is ready to yield markdown
    // and to avoid hydration mismatches if necessary, though BlockNote handles this well.

    const editor = useCreateBlockNote();

    // Load initial content
    useEffect(() => {
        async function load() {
            if (initialContent) {
                const blocks = editor.tryParseMarkdownToBlocks(initialContent);
                editor.replaceBlocks(editor.document, blocks);
            }
        }
        // Only load if editor is empty or we want to force reset (be careful with loops)
        // For now, we only load on mount if document is empty
        if (editor.document.length <= 1 && editor.document[0].content === undefined && initialContent) {
            load();
        }
    }, [editor, initialContent]); // basic dependency, might need refinement for updates

    const handleChange = async () => {
        if (onChange) {
            const markdown = editor.blocksToMarkdownLossy(editor.document);
            onChange(markdown);
        }
    };

    return (
        <div className={`border rounded-md overflow-hidden bg-card ${className || ""}`}>
            <BlockNoteView
                editor={editor}
                editable={editable}
                onChange={handleChange}
                theme={theme === "dark" ? "dark" : "light"}
                className="min-h-[100px]"
            />
        </div>
    );
}
