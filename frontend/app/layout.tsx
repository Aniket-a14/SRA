import React from "react"
import { headers } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"
import './globals.css'

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL("https://sra-xi.vercel.app"),
  title: {
    default: 'SRA - Smart Requirements Analyzer',
    template: '%s | SRA',
  },
  description: 'Turn raw stakeholder text into a verified IEEE-830 requirements specification with a multi-agent AI pipeline.',
  keywords: ["SRS", "Requirements Engineering", "AI", "IEEE-830", "Software Architecture"],
  // No `icons` key: app/favicon.ico is picked up by the App Router file convention
  // and served at /favicon.ico, so declaring it here would only duplicate the tag.
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Reading a per-request header is what opts the tree out of static rendering, which is
  // the precondition for Next stamping the CSP nonce onto its inline scripts at all.
  await headers()

  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
          attributes like data-gr-ext-installed onto <body> after SSR, which React
          otherwise flags as a hydration mismatch. Scoped to this one element — it
          only silences attribute diffs on <body> itself, not on the app tree. */}
      <body suppressHydrationWarning className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster closeButton />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
