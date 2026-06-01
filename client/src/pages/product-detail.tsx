import { useParams, Link } from "wouter";
import { ShoppingCart, ArrowLeft, FlaskConical, Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { useCart } from "@/stores/cart";
import { getProduct } from "@/lib/products";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const { toast } = useToast();
  const product = params?.slug ? getProduct(params.slug) : undefined;

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Product Not Found</h1>
        <Link href="/products"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Catalog</Button></Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      sku: product.sku,
    });
    toast({ title: "Added to cart", description: `${product.name} added to your cart.` });
  };

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="container mx-auto px-4 py-12">
        <Link href="/products">
          <Button variant="ghost" className="mb-6"><ArrowLeft className="mr-2 h-4 w-4" />Back to Catalog</Button>
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-square rounded-xl overflow-hidden bg-muted">
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-4">
            <Badge variant="outline" className="w-fit">Research Use Only</Badge>
            <h1 className="text-4xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground text-lg">{product.subtitle}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">${(product.price / 100).toFixed(2)}</span>
              {product.compareAtPrice && (
                <span className="text-muted-foreground line-through">${(product.compareAtPrice / 100).toFixed(2)}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
            <Button size="lg" onClick={handleAddToCart} disabled={!product.inStock}>
              <ShoppingCart className="mr-2 h-5 w-5" />
              {product.inStock ? "Add to Cart" : "Out of Stock"}
            </Button>
            <div className="border rounded-lg p-4 bg-muted/30 mt-2">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Research Use Only</p>
              <p className="text-xs text-muted-foreground">This compound is strictly intended for in-vitro laboratory research. Not for human consumption, injection, or any other use outside of controlled research settings.</p>
            </div>
            <div className="mt-2">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4" /> ≥99% Purity</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> COA Available</div>
            </div>
          </div>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
