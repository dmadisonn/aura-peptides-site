import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-neutral dark:prose-invert">
          <p>These terms govern your use of the Aura Peptides platform. All products are sold for research purposes only and are not intended for human consumption.</p>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
