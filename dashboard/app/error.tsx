"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="text-4xl">&#9888;&#65020;</div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Something went wrong
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
