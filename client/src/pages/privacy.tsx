import { useEffect } from "react";

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy Policy - Aura Peptides";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Read the Aura Peptides Privacy Policy covering data collection, usage, security, and your rights.";
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
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3 text-primary">
        Legal
      </p>
      <h1 className="text-2xl sm:text-3xl font-bold mb-8" data-testid="text-privacy-title">
        Privacy Policy
      </h1>

      <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us when placing an order, including your name, email address, shipping address, and payment information. Payment details are processed securely by Stripe and are not stored on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
          <p>
            We use the information we collect to process and fulfill your orders, communicate with you about your purchases, improve our products and services, and comply with legal obligations. We do not sell, rent, or share your personal information with third parties for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">3. Cookies and Tracking</h2>
          <p>
            Our website uses essential cookies to maintain your shopping cart and session. We may also use analytics cookies to understand how visitors interact with our website. You can control cookie preferences through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All transactions are encrypted using SSL technology.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">5. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements. Order information is retained for record-keeping purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">6. Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal information. You may also object to or restrict certain processing of your data. To exercise these rights, please contact us using the information provided below.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">7. Third-Party Services</h2>
          <p>
            Our website may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you access through our website.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on our website. Your continued use of our services after changes are posted constitutes acceptance of the revised policy.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t">
          Last updated: February 2026
        </p>
      </div>
    </div>
  );
}
