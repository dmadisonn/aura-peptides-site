import { Link } from "wouter";
import { ProductCard } from "@/components/product-card";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { getAllProducts } from "@/lib/products";

export default function ProductsPage() {
  const products = getAllProducts();

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Research Use Only</p>
          <h1 className="text-3xl font-bold mb-2">Research Peptide Catalog</h1>
          <p className="text-muted-foreground text-sm">All compounds are strictly for in-vitro research. Not for human consumption.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
