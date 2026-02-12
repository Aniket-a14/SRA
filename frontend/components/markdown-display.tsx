"use client"

import React, { memo } from 'react';
import { Streamdown } from 'streamdown';

interface MarkdownDisplayProps {
    content: string;
    className?: string;
}

export const MarkdownDisplay = memo(function MarkdownDisplay({ content, className }: MarkdownDisplayProps) {
    if (!content) return null;

    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className || ''}`}>
            <Streamdown>
                {content}
            </Streamdown>
        </div>
    );
});
