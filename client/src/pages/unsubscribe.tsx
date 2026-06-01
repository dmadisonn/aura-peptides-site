import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

export function ResubscribePage() {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Resubscribe</h1>
        <p className="text-muted-foreground">You have been resubscribed to our newsletter.</p>
      </main>
      <StoreFooter />
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Unsubscribe</h1>
        <p className="text-muted-foreground">You have been unsubscribed from our newsletter.</p>
      </main>
      <StoreFooter />
    </div>
  );
}
