import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

export default function TermsPage() {
  const effectiveDate = "June 2, 2026";
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3 text-primary">Legal</p>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective Date: {effectiveDate}</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-5">
            <p className="font-bold text-foreground uppercase tracking-wide text-xs mb-2">⚠ Research Use Only — Important Notice</p>
            <p>
              All products sold by Aura Peptides are intended <strong>strictly for in-vitro laboratory and research use only</strong>. 
              They are <strong>not approved by the U.S. Food and Drug Administration (FDA)</strong> for human or veterinary use, 
              are not intended to diagnose, treat, cure, or prevent any disease or medical condition, and must not be 
              administered to humans or animals under any circumstances. By purchasing from this site you affirm that 
              you understand and agree to this restriction without exception.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Aura Peptides website (aurapepts.bio) or placing an order, you agree to be bound 
              by these Terms of Service ("Terms") and all applicable laws and regulations. If you do not agree with any 
              part of these Terms, you are prohibited from using this site or purchasing any products.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Buyer Eligibility & Researcher Certification</h2>
            <p className="mb-3">
              By completing a purchase, you represent, warrant, and certify that:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are at least <strong>18 years of age</strong>.</li>
              <li>You are a <strong>qualified researcher, licensed scientist, or authorized institutional purchaser</strong> acquiring these compounds solely for legitimate scientific research purposes.</li>
              <li>You will use all purchased compounds exclusively in a <strong>properly equipped laboratory setting</strong> and in compliance with all applicable federal, state, and local laws and regulations.</li>
              <li>You will <strong>not resell, redistribute, or transfer</strong> any product to any individual who intends to use it for human or animal consumption.</li>
              <li>You understand that these compounds have <strong>not been evaluated or approved by the FDA</strong> and assume all risk associated with their use.</li>
              <li>You are <strong>not purchasing on behalf of any individual</strong> intending personal or recreational use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. FDA Disclaimer</h2>
            <p>
              These statements and products have <strong>not been evaluated by the Food and Drug Administration</strong>. 
              Aura Peptides products are not drugs and are not intended to diagnose, treat, cure, or prevent any disease. 
              All product descriptions, purity certifications, and technical data are provided for informational and 
              research reference purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Product Use Restrictions</h2>
            <p className="mb-3">You expressly agree that you will NOT:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use any product for human or animal consumption, injection, inhalation, or any form of personal administration.</li>
              <li>Use any product for any commercial purpose other than legitimate scientific research.</li>
              <li>Misrepresent your identity, credentials, or intended use when placing an order.</li>
              <li>Attempt to circumvent any verification, age, or eligibility requirement.</li>
              <li>Purchase products with the intent to resell to end consumers.</li>
            </ul>
            <p className="mt-3">
              Violation of these restrictions may result in immediate order cancellation, account termination, 
              and may be reported to appropriate regulatory authorities.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Orders, Pricing & Payment</h2>
            <p className="mb-2">
              All prices are listed in U.S. dollars. We reserve the right to modify pricing at any time without prior notice. 
              Orders are subject to acceptance and availability. We reserve the right to refuse or cancel any order at our 
              sole discretion, including orders that we believe are placed for non-research purposes.
            </p>
            <p>
              Payment is due at time of order. In the case of invoice orders, payment is due within the timeframe 
              specified on the invoice. Unpaid invoices may result in order cancellation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Shipping & Returns</h2>
            <p className="mb-2">
              We ship to U.S. addresses only unless otherwise specified. Shipping times are estimates and not guaranteed. 
              Risk of loss transfers to the buyer upon delivery to the carrier.
            </p>
            <p>
              Due to the nature of research compounds, <strong>all sales are final</strong>. We do not accept returns 
              on any peptide products. If you receive a damaged or incorrect item, contact us within 48 hours of delivery 
              and we will work to resolve the issue at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
            <p className="mb-2">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AURA PEPTIDES, ITS OWNERS, EMPLOYEES, AFFILIATES, 
              AND SUPPLIERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES 
              ARISING OUT OF OR RELATED TO YOUR USE OF, OR INABILITY TO USE, ANY PRODUCT PURCHASED FROM THIS SITE.
            </p>
            <p>
              Our total liability to you for any claim arising from a purchase shall not exceed the amount you paid 
              for the specific product giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Aura Peptides and its principals, employees, 
              and agents from and against any claims, liabilities, damages, losses, and expenses (including 
              reasonable attorneys' fees) arising out of or in any way connected with your purchase or use 
              of any product, your violation of these Terms, or your violation of any applicable law or 
              regulation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Intellectual Property</h2>
            <p>
              All content on this website — including text, images, logos, product descriptions, and design — 
              is the property of Aura Peptides and is protected by applicable copyright and trademark laws. 
              You may not reproduce, distribute, or create derivative works without express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States 
              and the state in which Aura Peptides is registered, without regard to conflict of law provisions. 
              Any dispute arising from these Terms or a purchase shall be resolved through binding arbitration 
              rather than in court, except that either party may seek injunctive relief in a court of competent 
              jurisdiction for alleged intellectual property violations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">11. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Updated Terms will be posted to this page 
              with a revised effective date. Your continued use of this site after any such changes constitutes 
              your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">12. Contact</h2>
            <p>
              For questions about these Terms, please contact us through the <a href="/contact" className="text-primary underline underline-offset-2">Contact page</a>.
            </p>
          </section>

        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
