import { Link, useLocation } from "wouter";
import { Home, Search, Heart, ShoppingCart, X, FileCheck } from "lucide-react";
import { useCart } from "@/stores/cart";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared/schema";

function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = (products ?? []).filter(
    (p) =>
      query.length > 0 &&
      (p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col" data-testid="mobile-search-overlay">
      <div className="flex items-center gap-3 p-3 border-b">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search peptides..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          data-testid="input-mobile-search"
        />
        <button onClick={onClose} data-testid="button-close-search">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Type to search products</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((product) => (
              <button
                key={product.id}
                className="flex items-center gap-3 w-full p-3 text-left hover-elevate"
                onClick={() => {
                  onClose();
                  navigate(`/products/${product.slug}`);
                }}
                data-testid={`search-result-${product.id}`}
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-muted/30 shrink-0">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{product.subtitle}</p>
                  <p className="text-xs font-medium mt-0.5">${product.price}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "Products", icon: Heart },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/certificates", label: "CoA", icon: FileCheck },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const { getItemCount } = useCart();
  const itemCount = getItemCount();
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = (href: string) => {
    return location === href;
  };

  return (
    <>
      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t" data-testid="nav-mobile-bottom">
        <div className="flex items-center justify-around py-2 px-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href}>
                <button
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 relative"
                  data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                >
                  <div className="relative">
                    <item.icon
                      className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`}
                      strokeWidth={active ? 2.5 : 1.5}
                    />
                    {item.label === "Cart" && itemCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 h-4 min-w-4 flex items-center justify-center text-[9px] font-bold text-primary-foreground bg-primary rounded-full px-1">
                        {itemCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] leading-tight ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}
          <button
            className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1"
            onClick={() => setSearchOpen(true)}
            data-testid="nav-mobile-search"
          >
            <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[10px] leading-tight text-muted-foreground">Search</span>
          </button>
        </div>
        <div className="flex justify-center pb-1">
          <div className="w-32 h-1 rounded-full bg-foreground/20" />
        </div>
      </nav>
    </>
  );
}
