export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3 text-primary">Legal</p>
        <h1 className="text-3xl font-bold mb-2">Refund & Return Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective Date: June 4, 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-5">
            <p className="font-bold text-foreground uppercase tracking-wide text-xs mb-2">⚠ Research Use Only</p>
            <p>All products sold by Aura Peptides are strictly for in-vitro laboratory and research use only. Not for human or veterinary use.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. General Policy</h2>
            <p>Due to the nature of research-grade peptide compounds, all sales are considered final once an order has been fulfilled and shipped. We do not accept returns of opened or used products under any circumstances. This policy exists to ensure product integrity, chain of custody, and regulatory compliance.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Eligible Refund Situations</h2>
            <p className="mb-3">We will issue a full refund or replacement in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Incorrect item shipped</strong> — You received a product different from what you ordered.</li>
              <li><strong>Damaged in transit</strong> — Product arrived visibly damaged or compromised (photo documentation required).</li>
              <li><strong>Lost shipment</strong> — Order confirmed lost by the carrier after an investigation period.</li>
              <li><strong>Significant purity discrepancy</strong> — Third-party verified purity falls substantially below our stated specification.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. How to Request a Refund</h2>
            <p className="mb-3">To initiate a refund or replacement claim:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Email <strong>support@aurapepts.bio</strong> within <strong>7 days</strong> of receiving your order.</li>
              <li>Include your order number, a description of the issue, and photographic evidence if applicable.</li>
              <li>Our team will respond within 2 business days with next steps.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Non-Refundable Items</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Orders cancelled after fulfillment has begun.</li>
              <li>Products returned without prior written authorization.</li>
              <li>Products that have been opened, used, or stored outside recommended conditions.</li>
              <li>Buyer's remorse or change of mind after shipment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Refund Processing</h2>
            <p>Approved refunds are processed within 5–10 business days. Refunds are issued to the original payment method used at the time of purchase.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Contact Us</h2>
            <p>Questions about this policy? Contact us at <strong>support@aurapepts.bio</strong> or visit our <a href="/contact" className="text-primary underline">Contact page</a>.</p>
          </section>

        </div>
      </main>
    </div>
  );
}
