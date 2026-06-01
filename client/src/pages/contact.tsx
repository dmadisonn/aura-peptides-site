import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12 max-w-xl">
        <h1 className="text-3xl font-bold mb-8">Contact Us</h1>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Input placeholder="Your name" />
          <Input type="email" placeholder="Email address" />
          <Textarea placeholder="Message" rows={5} />
          <Button type="submit">Send Message</Button>
        </form>
      </main>
      <StoreFooter />
    </div>
  );
}
