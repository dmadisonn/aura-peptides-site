import { Link } from "wouter";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product }: { product: any }) {
  const displayPrice = product.price > 500 ? `$${(product.price / 100).toFixed(2)}` : `$${product.price?.toFixed(2) ?? "0.00"}`;

  return (
    <Link href={`/products/${product.slug}`}>
      <Card className="group overflow-visible cursor-pointer flex flex-col h-full hover:shadow-lg transition-shadow">
        <div className="relative overflow-hidden rounded-t-md bg-muted/30 aspect-square">
          <img
            src={product.imageUrl || product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {!product.inStock && !product.in_stock && (
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
          </div>
          <div className="flex items-center justify-between mt-auto pt-2">
            <span className="font-bold text-base">{displayPrice}</span>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={(e) => e.preventDefault()}>
              <FileText className="h-3 w-3" />
              View Details
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Invoice-based ordering · Verified researchers only</p>
        </div>
      </Card>
    </Link>
  );
}
