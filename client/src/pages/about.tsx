import { useEffect } from "react";
import { AuraLogo } from "@/components/aura-logo";
import { PoweredByMindctrl } from "@/components/powered-by-mindctrl";

export default function AboutPage() {
  useEffect(() => {
    document.title = "About — Aura Peptides";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Aura Peptides — refined research-grade peptide compounds, lab-verified and quietly precise.";
    if (meta) {
      meta.setAttribute("content", desc);
    } else {
      const tag = document.createElement("meta");
      tag.name = "description";
      tag.content = desc;
      document.head.appendChild(tag);
    }
  }, []);

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section
        className="relative overflow-hidden py-24 sm:py-32"
        data-testid="section-about-hero"
      >
        <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
          <svg
            viewBox="0 0 800 800"
            className="w-[800px] h-[800px] opacity-[0.45] dark:opacity-[0.3]"
            fill="none"
          >
            <circle cx="400" cy="400" r="370" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            <circle cx="400" cy="400" r="280" stroke="currentColor" strokeWidth="0.5" opacity="0.28" />
            <circle cx="400" cy="400" r="200" stroke="currentColor" strokeWidth="0.5" opacity="0.36" />
            <circle cx="400" cy="400" r="130" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
            <circle cx="400" cy="400" r="70" stroke="currentColor" strokeWidth="0.7" opacity="0.7" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-5">
            About Aura
          </p>
          <h1
            className="font-display text-5xl sm:text-6xl tracking-tight leading-[1.05] font-normal text-foreground mb-6"
            data-testid="text-about-title"
          >
            Quiet rigor for
            <br />
            <span className="italic text-foreground/85">research peptides.</span>
          </h1>
          <p className="text-foreground/70 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Considered sourcing, documented purity, and an aesthetic that reflects the seriousness
            of the work. That's the Aura standard.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="py-20 border-t border-border/60">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 text-base text-foreground/80 leading-relaxed font-sans">
            <p data-testid="text-about-body">
              Aura Peptides was founded on a simple observation: the research community was being
              served loud, oversold, and inconsistently documented compounds. We set out to build
              the opposite.
            </p>
            <p>
              Every Aura compound is independently tested at U.S.-based laboratories and supported
              by a Certificate of Analysis. We maintain a deliberately small catalog of verified
              peptides — not a sprawling marketplace. Each product is presented with clear
              standards, accurate amounts, and the documentation a researcher actually needs.
            </p>
            <p>
              The name <span className="font-display italic">Aura</span> refers to a quiet kind of
              presence — the unmistakable feeling of something refined. That's the bar we hold our
              work to.
            </p>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="py-20 border-t border-border/60 bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3 text-center">
            Our Principles
          </p>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight font-normal text-center mb-14">
            How we work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12 max-w-5xl mx-auto">
            {[
              {
                title: "Documented",
                body: "Every batch is independently tested and supported by a Certificate of Analysis. No exceptions, no opaque sourcing.",
              },
              {
                title: "Restrained",
                body: "We curate a small catalog of verified compounds — not a marketplace. Quality of selection over quantity of listings.",
              },
              {
                title: "Considered",
                body: "From packaging to product copy, every choice reflects the seriousness of laboratory research.",
              },
            ].map((principle) => (
              <div key={principle.title}>
                <p className="font-display text-2xl tracking-tight mb-3">{principle.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{principle.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARK */}
      <section className="py-20 border-t border-border/60">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <AuraLogo variant="stacked" className="mx-auto text-foreground" showTagline={true} />
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mt-8">
            For verified researchers only
          </p>
          <div className="mt-6 flex justify-center">
            <PoweredByMindctrl testId="link-powered-by-mindctrl-about" />
          </div>
        </div>
      </section>
    </div>
  );
}
