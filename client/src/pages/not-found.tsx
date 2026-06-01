import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Home } from "lucide-react";
import { AuraLogo } from "@/components/aura-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  useEffect(() => {
    document.title = "Page Not Found — Aura Peptides";
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background text-foreground flex items-center justify-center px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 35%, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse 60% 55% at 50% 40%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 55% at 50% 40%, black 30%, transparent 80%)",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
      />

      <div className="relative w-full max-w-xl text-center">
        <div className="flex justify-center mb-10">
          <AuraLogo
            variant="mark"
            className="h-24 w-24 text-foreground/85"
          />
        </div>

        <p
          className="text-[0.6rem] sm:text-xs uppercase tracking-[0.5em] text-muted-foreground mb-6"
          data-testid="text-404-eyebrow"
        >
          Error · 404
        </p>

        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight leading-[1.05] mb-5"
          data-testid="text-404-title"
        >
          This frequency
          <br />
          isn&rsquo;t tuned in.
        </h1>

        <p
          className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed mb-10"
          data-testid="text-404-description"
        >
          The page you&rsquo;re searching for has drifted out of range. It may have
          been moved, retired, or the link is no longer in alignment.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full px-7 min-w-[180px]"
            data-testid="button-404-home"
          >
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="rounded-full px-7 min-w-[180px] text-muted-foreground hover:text-foreground"
            data-testid="button-404-shop"
          >
            <Link href="/shop">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Browse Catalog
            </Link>
          </Button>
        </div>

        <div className="mt-16 flex items-center justify-center gap-3 text-[0.6rem] uppercase tracking-[0.4em] text-muted-foreground/70">
          <span className="h-px w-8 bg-muted-foreground/30" />
          <span>Aura Peptides</span>
          <span className="h-px w-8 bg-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
}
