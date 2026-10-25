// Types the `meta` export that remark-mdx-frontmatter generates from each release
// note's YAML frontmatter, so it is typed data at the import site rather than
// something the page has to parse back out of the document. The default export (the
// compiled MDX component) is already declared by @types/mdx and merges with this.
// That only works while @types/mdx is loaded: TypeScript 6 stopped auto-including every
// @types package (`types` defaults to []), so tsconfig.json lists "mdx" in `types`.
// Drop it and every `import X from "*.mdx"` types as the module namespace instead.
//
// No top-level import/export: that would make this file a module, and `declare
// module "*.mdx"` inside a module is a module augmentation, which cannot match a
// wildcard pattern. Imports go inside the block instead.
declare module "*.mdx" {
    import type { ReleaseMeta } from "@/lib/changelog"

    export const meta: ReleaseMeta
}
