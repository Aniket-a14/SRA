"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sparkles, Menu, X, LogOut, User, Folder } from "lucide-react"
import { AnimatedThemeToggler } from "./ui/animated-theme-toggler"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()

  const navLinks = [
    { href: "/#home", label: "Home" },
    { href: "/#analyzer", label: "Analyzer" },
    { href: "/#about", label: "About" },
    { href: "/#faq", label: "FAQ" },
  ]

  const handleLogout = () => {
    logout()
    setIsOpen(false)
    router.push("/")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

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

          {!isLoading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image} alt={user.name} />
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/analysis")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>My Analysis</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/projects")}>
                    <Folder className="mr-2 h-4 w-4" />
                    <span>Projects</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex gap-2">
                <Button variant="ghost" onClick={() => router.push("/auth/login")}>
                  Sign In
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                  onClick={() => router.push("/auth/signup")}
                >
                  Get Started
                </Button>
              </div>
            )
          )}

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

                <div className="mt-6 pt-6 border-t border-border space-y-3">
                  {user ? (
                    <>
                      <div className="flex items-center gap-3 px-2 mb-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.image} alt={user.name} />
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full justify-start" onClick={() => { setIsOpen(false); router.push("/projects"); }}>
                        <Folder className="mr-2 h-4 w-4" />
                        Projects
                      </Button>
                      <Button variant="outline" className="w-full justify-start" onClick={() => { setIsOpen(false); router.push("/analysis"); }}>
                        <User className="mr-2 h-4 w-4" />
                        My Analysis
                      </Button>
                      <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" className="w-full h-11 text-base" onClick={() => { setIsOpen(false); router.push("/auth/login"); }}>
                        Sign In
                      </Button>
                      <Button className="w-full bg-primary hover:bg-primary/90 h-11 text-base shadow-md" onClick={() => { setIsOpen(false); router.push("/auth/signup"); }}>
                        Get Started
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
