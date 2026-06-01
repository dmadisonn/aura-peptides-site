import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/stores/cart";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl ?? "",
    });
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const displayPrice = product.price > 500 ? `$${(product.price / 100).toFixed(2)}` : `$${product.price.toFixed(2)}`;

  return (
    <Link href={`/products/${product.slug}`}>
      <Card className="group overflow-visible cursor-pointer flex flex-col h-full hover:shadow-lg transition-shadow">
        <div className="relative overflow-hidden rounded-t-md bg-muted/30 aspect-square">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {!product.inStock && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary">Out of Stock</Badge>
            </div>
          )}
          {product.featured && (
            <Badge className="absolute top-3 left-3">Featured</Badge>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1 gap-2">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{product.subtitle}</p>
            <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{product.sku}</p>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-lg font-bold text-primary">{displayPrice}</span>
            <Button size="sm" disabled={!product.inStock} onClick={handleAddToCart}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  );
}
