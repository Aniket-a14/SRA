import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const isProd = process.env.NODE_ENV === 'production';

// 'unsafe-eval' is only needed by Next.js dev-mode Fast Refresh/eval source maps —
// production builds don't require it. Same for the localhost connect-src allowance,
// which exists purely so local dev can talk to a local backend.
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline' https://vercel.live https://*.vercel.live;"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.live;";

const connectSrc = isProd
  ? "connect-src 'self' https://generativelanguage.googleapis.com https://sra-backend-six.vercel.app;"
  : "connect-src 'self' http://localhost:* https://generativelanguage.googleapis.com https://sra-backend-six.vercel.app;";

const contentSecurityPolicy = `default-src 'self'; ${scriptSrc} frame-src 'self' https://vercel.live https://*.vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; ${connectSrc} frame-ancestors 'none';`;

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy
          },
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
