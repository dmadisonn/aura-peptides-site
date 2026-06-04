import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Clock, Phone } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3 text-primary">Get in Touch</p>
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-sm text-muted-foreground mb-10">Questions about an order, product documentation, or general inquiries — we're here.</p>

        <div className="grid md:grid-cols-2 gap-10">

          {/* Business Info */}
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-4">Business Information</p>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-foreground">Aura Health LLC</p>
                  <p className="text-muted-foreground">DBA Aura Peptides</p>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Address</p>
                    <p className="text-muted-foreground">6586 W Atlantic Ave, Ste 1112</p>
                    <p className="text-muted-foreground">Delray Beach, FL 33446</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Phone</p>
                    <a href="tel:+16293325351" className="text-muted-foreground hover:text-primary transition-colors">(629) 332-5351</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <a href="mailto:support@aurapepts.bio" className="text-muted-foreground hover:text-primary transition-colors">
                      support@aurapepts.bio
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Response Time</p>
                    <p className="text-muted-foreground">Within 1–2 business days</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4 text-xs text-muted-foreground leading-relaxed">
              <p className="font-bold text-foreground uppercase tracking-wide text-[10px] mb-1">⚠ Research Use Only</p>
              All products are sold strictly for in-vitro laboratory and scientific research use only. Not for human or veterinary use.
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-4">Send a Message</p>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Input placeholder="Your name" data-testid="input-contact-name" />
              <Input type="email" placeholder="Email address" data-testid="input-contact-email" />
              <Input placeholder="Order number (if applicable)" data-testid="input-contact-order" />
              <Textarea placeholder="How can we help?" rows={5} data-testid="input-contact-message" />
              <Button type="submit" className="w-full rounded-full" data-testid="button-contact-submit">
                Send Message
              </Button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
