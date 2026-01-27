import type { Metadata, Viewport } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL("https://sra-xi.vercel.app"),
  title: {
    default: "Smart Requirements Analyzer | AI-Powered SRS Tool",
    template: "%s | SRA",
  },
  description: "Transform your raw project ideas into professional IEEE-830 Software Requirements Specifications (SRS) with our 5-Layer AI Agentic Pipeline.",
  keywords: ["SRS", "Requirements Engineering", "AI", "Gemini", "Software Architecture", "IEEE-830"],
  authors: [{ name: "SRA Team" }],
  creator: "SRA Team",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sra-xi.vercel.app/",
    title: "Smart Requirements Analyzer",
    description: "Automated, Professional SRS Generation for Enterprise Software.",
    siteName: "Smart Requirements Analyzer",
    images: [
      {
        url: "/assets/og-image.png",
        width: 1200,
        height: 630,
        alt: "SRA Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Requirements Analyzer",
    description: "Turn ideas into specs in seconds.",
    images: ["/assets/og-image.png"],
    creator: "@sra_team",
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
