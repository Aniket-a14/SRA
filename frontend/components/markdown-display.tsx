"use client"

import React, { memo } from 'react';
import { Streamdown } from 'streamdown';

interface MarkdownDisplayProps {
    content: string;
    className?: string;
}

export const MarkdownDisplay = memo(function MarkdownDisplay({ content, className }: MarkdownDisplayProps) {
    if (!content) return null;

    const isInline = className?.includes('inline');
    const Component = isInline ? 'span' : 'div';

    return (
        <Component className={`prose prose-sm dark:prose-invert max-w-none ${isInline ? '!inline [&_*]:!inline [&_*]:!m-0 [&_*]:!p-0' : ''} ${className || ''}`}>
            <Streamdown>
                {content}
            </Streamdown>
        </Component>
    );
});
