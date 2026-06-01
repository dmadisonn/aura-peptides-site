import { Link } from "wouter";
import { ArrowRight, FlaskConical, Shield, Sparkles, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { AuraLogo } from "@/components/aura-logo";
import { FreeShippingBanner } from "@/components/free-shipping-banner";
import { getFeaturedProducts, getAllProducts } from "@/lib/products";

const features = [
  { icon: Shield, title: "Research Grade Purity", description: "≥99% purity verified by third-party COA for all compounds." },
  { icon: FlaskConical, title: "Lab Tested", description: "Every batch independently tested and verified." },
  { icon: Sparkles, title: "Fast Fulfillment", description: "Orders processed same business day." },
  { icon: Leaf, title: "Research Only", description: "Strictly for in-vitro research. Not for human use." },
];

export default function HomePage() {
  const featured = getFeaturedProducts();
  const displayProducts = featured.length > 0 ? featured : getAllProducts().slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <FreeShippingBanner />
      <StoreHeader />

      {/* Hero */}
      <section className="relative py-24 px-4 bg-gradient-to-br from-background to-muted overflow-hidden">
        <div className="container mx-auto text-center max-w-3xl">
          <AuraLogo className="mx-auto mb-8 h-20 w-auto" />
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Research Use Only — Not For Human Consumption</p>
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Research Grade<br />Peptide Compounds
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Premium research-grade peptides for qualified laboratories and research institutions.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/products">
              <Button size="lg">Browse Catalog <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline">Learn More</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="flex flex-col items-center text-center p-6 rounded-lg bg-background border">
                <f.icon className="h-8 w-8 mb-3 text-primary" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-2xl font-bold mb-8">Featured Compounds</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/products">
              <Button variant="outline" size="lg">View Full Catalog <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </section>

      <StoreFooter />
    </div>
  );
}
