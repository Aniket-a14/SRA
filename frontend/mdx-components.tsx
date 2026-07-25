import type { MDXComponents } from "mdx/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Element styling for MDX release notes. The project has no @tailwindcss/typography
// plugin, so there is no `prose` class to lean on — each element is styled here once
// instead of being decorated at every call site inside the content files.
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    h2: ({ children, ...props }) => (
      <h3
        className="mt-10 mb-4 text-lg font-medium tracking-tight text-foreground first:mt-0"
        {...props}
      >
        {children}
      </h3>
    ),
    h3: ({ children, ...props }) => (
      <h4
        className="mt-8 mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground first:mt-0"
        {...props}
      >
        {children}
      </h4>
    ),
    p: ({ children, ...props }) => (
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground break-words" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className="mb-5 space-y-3" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="mb-5 space-y-3 list-decimal pl-5 marker:text-muted-foreground" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li
        className="relative pl-5 text-sm leading-relaxed text-muted-foreground break-words before:absolute before:left-0 before:top-[0.6em] before:size-1 before:rounded-full before:bg-foreground/30 [ol>&]:pl-0 [ol>&]:before:hidden"
        {...props}
      >
        {children}
      </li>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-medium text-foreground" {...props}>
        {children}
      </strong>
    ),
    // Note: inline code is styled in globals.css under `.release-note code`, not here.
    // A note may write `<code>` as JSX inside an <Accordion>, and JSX elements authored
    // directly in MDX bypass this component map entirely — CSS catches both paths.
    a: ({ children, ...props }) => (
      <a
        className="underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="mb-5 border-l-2 border-foreground/15 pl-4 text-sm italic leading-relaxed text-muted-foreground"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className="my-8 border-foreground/10" {...props} />,
    table: ({ children, ...props }) => (
      // Wide tables scroll inside their own container rather than widening the page,
      // so a flag name in a narrow column scrolls instead of breaking across lines.
      <div className="mb-5 overflow-x-auto">
        <table className="w-full text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border-b border-foreground/10 py-2 pr-4 text-left font-medium text-foreground"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border-b border-foreground/5 py-2 pr-4 align-top text-muted-foreground" {...props}>
        {children}
      </td>
    ),
    Accordion,
    AccordionItem,
    // Underlining the whole trigger on hover reads as a broken link next to the real
    // links in the body; the chevron already signals that it is interactive.
    AccordionTrigger: ({ className, ...props }) => (
      <AccordionTrigger className={`hover:no-underline ${className ?? ""}`} {...props} />
    ),
    AccordionContent,
    ...components,
  };
}
