"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function Footer() {
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up")
          }
        })
      },
      { threshold: 0.1 },
    )

    const elements = footerRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <footer ref={footerRef} className="border-t border-border bg-secondary/5">
      <div className="container mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-12">
          <div className="sm:col-span-2 lg:col-span-1 animate-on-scroll opacity-0">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">ReqAnalyzer</span>
            </Link>
            <p className="text-sm text-muted-foreground">Transform requirements into structured insights with AI.</p>
          </div>

          <div className="animate-on-scroll opacity-0 delay-100">
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="#about"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/coming-soon"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="#faq"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          <div className="animate-on-scroll opacity-0 delay-200">
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="#about"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/coming-soon"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/coming-soon"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          <div className="animate-on-scroll opacity-0 delay-300">
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/coming-soon"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/coming-soon"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Terms
                </Link>
              </li>
              <li>
                <a
                  href="mailto:aniketsahaworkspace@gmail.com"
                  className="hover:text-foreground transition-colors inline-block hover:translate-x-1 duration-200"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 md:my-12" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground animate-on-scroll opacity-0 delay-400">
          <p>2025 ReqAnalyzer. All rights reserved.</p>
          <p>Built with Next.js and shadcn/ui</p>
        </div>
      </div>
    </footer>
  )
}
