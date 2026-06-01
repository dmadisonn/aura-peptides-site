import { Link, useLocation } from "wouter";
import { ShoppingCart, Sun, Moon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/stores/cart";
import { useTheme } from "@/components/theme-provider";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { AuraLogo } from "@/components/aura-logo";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import type { Product } from "@shared/schema";

function DesktopSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const filtered = (products ?? []).filter(
    (p) =>
      query.length > 0 &&
      (p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()))
  );

  if (!open) {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="hidden md:inline-flex"
        onClick={() => { setOpen(true); setQuery(""); }}
        data-testid="button-desktop-search"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center border rounded-md bg-background px-3 gap-2 w-64">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search peptides..."
          className="flex-1 bg-transparent text-sm py-2 outline-none placeholder:text-muted-foreground"
          data-testid="input-desktop-search"
        />
        <button
          onClick={() => { setOpen(false); setQuery(""); }}
          className="text-muted-foreground"
          data-testid="button-close-desktop-search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {query.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-md shadow-lg max-h-80 overflow-y-auto z-50">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground text-center">No results for "{query}"</p>
          ) : (
            filtered.map((product) => (
              <button
                key={product.id}
                className="flex items-center gap-3 w-full p-3 text-left hover-elevate"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  navigate(`/products/${product.slug}`);
                }}
                data-testid={`desktop-search-result-${product.id}`}
              >
                <div className="w-10 h-10 rounded-md overflow-hidden bg-muted/30 shrink-0">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{product.subtitle}</p>
                </div>
                <p className="text-sm font-medium shrink-0">${product.price}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function StoreHeader() {
  const [location] = useLocation();
  const { getItemCount } = useCart();
  const { theme, setTheme } = useTheme();
  const itemCount = getItemCount();

  const flags = useFeatureFlags();
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Shop" },
    { href: "/certificates", label: "CoA" },
    { href: "/about", label: "About" },
    ...(flags.affiliates ? [{ href: "/affiliates", label: "Affiliates" }] : []),
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" data-testid="link-home" className="flex items-center text-foreground">
              <AuraLogo className="h-7 sm:h-8 text-foreground" />
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={location === link.href ? "secondary" : "ghost"}
                    size="sm"
                    className="text-[13px] font-medium tracking-wide"
                    data-testid={`link-nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <DesktopSearch />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/cart" className="flex items-center justify-center h-9 w-9 relative">
              <Button variant="ghost" size="icon" className="h-9 w-9 relative" data-testid="button-cart">
                <ShoppingCart className="h-4 w-4" />
                {itemCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-[10px] px-1"
                    data-testid="badge-cart-count"
                  >
                    {itemCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
