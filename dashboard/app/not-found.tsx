import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-5xl font-bold text-[hsl(var(--foreground))]">404</h1>
      <p className="text-[hsl(var(--muted-foreground))]">Page not found.</p>
      <Button asChild variant="outline">
        <Link href="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
