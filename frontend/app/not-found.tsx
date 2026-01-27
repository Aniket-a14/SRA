import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, SearchX } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-8">
                <SearchX className="h-10 w-10 text-muted-foreground" />
            </div>

            <h2 className="text-3xl font-bold tracking-tight mb-4">Page Not Found</h2>

            <p className="text-muted-foreground max-w-md mb-8">
                The page you are looking for does not exist or has been moved.
            </p>

            <Button asChild size="lg" className="gap-2">
                <Link href="/">
                    <ArrowLeft className="h-4 w-4" />
                    Return Home
                </Link>
            </Button>
        </div>
    )
}
