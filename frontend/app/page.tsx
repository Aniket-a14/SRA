import { Suspense } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { HomeClient } from "./home-client"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <HomeClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
