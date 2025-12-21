import React from 'react';

export const renderMarkdown = (text: string | null | undefined) => {
    if (!text) return null;
    return String(text).split(/(\*\*.*?\*\*)/g).map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={idx}>{part}</span>;
    });
};
