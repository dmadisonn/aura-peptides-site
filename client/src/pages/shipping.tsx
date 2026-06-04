export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3 text-primary">Legal</p>
        <h1 className="text-3xl font-bold mb-2">Shipping Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective Date: June 4, 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-5">
            <p className="font-bold text-foreground uppercase tracking-wide text-xs mb-2">⚠ Research Use Only</p>
            <p>All products sold by Aura Peptides are strictly for in-vitro laboratory and research use only. Not for human or veterinary use.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Order Processing</h2>
            <p>Orders are processed within <strong>1–3 business days</strong> of invoice confirmation and payment receipt. Orders placed on weekends or federal holidays will be processed the next available business day. You will receive a confirmation email once your order has shipped.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Shipping Methods & Timeframes</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Standard Shipping (USPS/UPS):</strong> 3–7 business days</li>
              <li><strong>Expedited Shipping:</strong> 2–3 business days (available at checkout)</li>
              <li><strong>Overnight:</strong> Available on select orders — contact us for a quote</li>
            </ul>
            <p className="mt-3">All orders over <strong>$100</strong> qualify for free standard shipping within the contiguous United States.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Packaging</h2>
            <p>All research compounds are packaged in tamper-evident, temperature-appropriate containers with appropriate labeling. We ship discreetly — no product names or company branding visible on the exterior packaging.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Shipping Restrictions</h2>
            <p className="mb-3">We currently ship within the <strong>United States only</strong>. We do not ship internationally at this time. It is the buyer's sole responsibility to verify that the importation and possession of any purchased compound is legal within their jurisdiction. Aura Peptides assumes no liability for orders seized or rejected by customs or law enforcement.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Tracking</h2>
            <p>A tracking number will be provided via email once your order ships. Tracking updates may take 24–48 hours to reflect after the label is created.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Lost or Damaged Shipments</h2>
            <p>If your order is lost in transit or arrives damaged, please contact us at <strong>support@aurapepts.bio</strong> within <strong>7 days</strong> of the expected delivery date. See our <a href="/refund" className="text-primary underline">Refund Policy</a> for more details.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Contact</h2>
            <p>Shipping questions? Email <strong>support@aurapepts.bio</strong> or visit our <a href="/contact" className="text-primary underline">Contact page</a>.</p>
          </section>

        </div>
      </main>
    </div>
  );
}
