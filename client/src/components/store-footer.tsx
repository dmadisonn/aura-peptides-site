import { Link } from "wouter";
import { AuraLogo } from "@/components/aura-logo";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { PoweredByMindctrl } from "@/components/powered-by-mindctrl";

export function StoreFooter() {
  const flags = useFeatureFlags();
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 pb-28 md:pb-12">
        <div className="md:grid md:grid-cols-4 md:gap-10 mb-10">
          <div className="md:col-span-2 flex flex-col items-center text-center md:items-start md:text-left space-y-4 mb-12 md:mb-0">
            <Link href="/" data-testid="link-footer-logo" className="text-foreground">
              <AuraLogo className="h-9 text-foreground" />
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Refined research-grade peptide compounds. Lab-verified, third-party tested,
              and quietly precise.
            </p>
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
              For research use only
            </p>
          </div>

          <div className="flex justify-center md:contents">
            <div className="grid grid-cols-2 gap-x-12 sm:gap-x-16 md:contents text-left">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
                  Catalog
                </p>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <Link href="/products" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-shop">
                      Shop all peptides
                    </Link>
                  </li>
                  <li>
                    <Link href="/certificates" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-coa">
                      Certificates of Analysis
                    </Link>
                  </li>
                  {flags.affiliates && (
                    <li>
                      <Link href="/affiliates" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-affiliates">
                        Affiliate program
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
                  Company
                </p>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <Link href="/about" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-about">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-contact">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-terms">
                      Terms
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link href="/refund" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-refund">
                      Refund Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/shipping" className="text-foreground/80 hover:text-foreground transition-colors" data-testid="link-footer-shipping">
                      Shipping Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-border/60">
          <div className="text-xs text-muted-foreground text-center sm:text-left space-y-1">
            <p data-testid="text-copyright">&copy; {new Date().getFullYear()} Aura Peptides. All rights reserved.</p>
            <p>Darci Madison LLC DBA Aura Peptides &bull; 6586 W Atlantic Ave, Ste 1112, Delray Beach, FL 33446</p>
            <p>support@aurapepts.bio &bull; (629) 332-5351</p>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed text-center sm:text-right sm:whitespace-nowrap max-w-xs sm:max-w-none">
            All products are sold strictly for laboratory research use only. Not for human or veterinary use.
          </p>
        </div>

        <div className="flex justify-center pt-6 mt-2 border-t border-border/40">
          <PoweredByMindctrl testId="link-powered-by-mindctrl-footer" />
        </div>
      </div>
    </footer>
  );
}
