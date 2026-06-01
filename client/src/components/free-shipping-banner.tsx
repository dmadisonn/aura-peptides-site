import { Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function FreeShippingBanner() {
  const { data } = useQuery<{ threshold: number | null }>({
    queryKey: ["/api/settings/free-shipping-threshold"],
  });

  const threshold = data?.threshold;
  if (!threshold || threshold <= 0) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 text-center" data-testid="banner-free-shipping">
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <Truck className="h-4 w-4" />
        <span>Free shipping on orders over ${threshold}</span>
      </div>
    </div>
  );
}

export function FreeShippingInline() {
  const { data } = useQuery<{ threshold: number | null }>({
    queryKey: ["/api/settings/free-shipping-threshold"],
  });

  const threshold = data?.threshold;
  if (!threshold || threshold <= 0) return null;

  return (
    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="text-free-shipping-promo">
      <Truck className="h-3 w-3" />
      Free shipping on orders over ${threshold}
    </p>
  );
}
