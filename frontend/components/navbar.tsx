"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Sparkles, Menu, X } from "lucide-react"
import { AnimatedThemeToggler } from "./ui/animated-theme-toggler"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  const navLinks = [
    { href: "#home", label: "Home" },
    { href: "#analyzer", label: "Analyzer" },
    { href: "#about", label: "About" },
    { href: "#faq", label: "FAQ" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">SRAnalyzer</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <AnimatedThemeToggler />
          <Button
            size="sm"
            className="hidden sm:flex bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
          >
            Get Started
          </Button>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="relative">
                <Menu
                  className={`h-5 w-5 transition-all duration-300 ${isOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
                />
                <X
                  className={`h-5 w-5 absolute transition-all duration-300 ${isOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
                />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-background border-l border-border p-6">
              <SheetHeader className="text-left mb-6">
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-lg font-bold">SRAnalyzer</span>
                </SheetTitle>
              </SheetHeader>

              <Separator className="mb-6" />

              <nav className="flex flex-col gap-2">
                {navLinks.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center py-3 px-4 text-base font-medium text-foreground/80 hover:text-primary hover:bg-primary/10 rounded-md transition-all duration-200 animate-slide-in-right"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="mt-6 pt-6 border-t border-border">
                  <Button className="w-full bg-primary hover:bg-primary/90 h-11 text-base shadow-md animate-slide-in-right delay-400">
                    Get Started
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
