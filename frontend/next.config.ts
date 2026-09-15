import type { NextConfig } from "next";
import createMDX from "@next/mdx";

// The Content-Security-Policy is NOT set here any more — it is built per request in
// proxy.ts, because it carries a nonce and a nonce that is the same on every response
// is not a nonce. Everything below is static and stays.
const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // Test files have no business gating a production build, and shouldn't need to:
    // they're already typechecked by the separate `tsc --noEmit` CI step (full workspace
    // install) and by vitest itself. Routing `next build` at test files at all was
    // incidental (one shared tsconfig), and it broke production builds outright once a
    // narrower, image-minimizing install (Dockerfile's `pnpm install --filter frontend...
    // --filter .`) hoisted `@testing-library/jest-dom`/`vitest` differently than a full
    // workspace install — Linux-only, so it passed everywhere this was tested until the
    // real Docker build hit it. tsconfig.build.json is identical to tsconfig.json minus
    // test files.
    tsconfigPath: "./tsconfig.build.json",
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ]
      }
    ]
  }
};

// Release notes are authored as MDX under content/changelog. Plugins are named as
// strings rather than imported: Turbopack serializes this config, so a function
// reference here fails the build.
const withMDX = createMDX({
  options: {
    remarkPlugins: [
      // MDX is CommonMark by default; release notes use GFM tables.
      "remark-gfm",
      "remark-frontmatter",
      // Re-exports the YAML frontmatter as a named `meta` export, so a release's
      // title, date and tags are typed data rather than something to scrape.
      ["remark-mdx-frontmatter", { name: "meta" }],
    ],
  },
});

export default withMDX(nextConfig);
