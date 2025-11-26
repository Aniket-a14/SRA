import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { SmoothCursor } from "@/components/ui/smooth-cursor"

export const metadata: Metadata = {
  title: "Smart Requirements Analyzer",
  description: "Transform raw requirements into structured insights with AI-powered analysis",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans antialiased`}>
        <SmoothCursor />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
