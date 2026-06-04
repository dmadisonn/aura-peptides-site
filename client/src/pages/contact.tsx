import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Clock, Phone, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", order: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send. Please email us directly.");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <CheckCircle className="h-10 w-10 text-primary" />
                <p className="font-semibold text-foreground">Message sent!</p>
                <p className="text-sm text-muted-foreground">We'll get back to you within 1–2 business days.</p>
              </div>
            ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input placeholder="Your name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required data-testid="input-contact-name" />
              <Input type="email" placeholder="Email address" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required data-testid="input-contact-email" />
              <Input placeholder="Order number (if applicable)" value={form.order} onChange={e => setForm(f => ({...f, order: e.target.value}))} data-testid="input-contact-order" />
              <Textarea placeholder="How can we help?" rows={5} value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} required data-testid="input-contact-message" />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full rounded-full" disabled={loading} data-testid="button-contact-submit">
                {loading ? "Sending…" : "Send Message"}
              </Button>
            </form>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
