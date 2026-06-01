import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

const AFF_TOKEN_KEY = "aura-aff-token";
const AFF_DISCOUNT_KEY = "aura-aff-discount";
const AFF_CODE_KEY = "aura-aff-code";
const AFF_EXPIRES_KEY = "aura-aff-expires";

export function getAffiliateToken(): string | null {
  const expires = localStorage.getItem(AFF_EXPIRES_KEY);
  if (expires && Date.now() > parseInt(expires, 10)) {
    clearAffiliateData();
    return null;
  }
  return localStorage.getItem(AFF_TOKEN_KEY);
}

export function getAffiliateDiscount(): number {
  const val = localStorage.getItem(AFF_DISCOUNT_KEY);
  return val ? parseInt(val, 10) : 0;
}

export function getAffiliateCode(): string | null {
  return localStorage.getItem(AFF_CODE_KEY);
}

export function clearAffiliateData() {
  localStorage.removeItem(AFF_TOKEN_KEY);
  localStorage.removeItem(AFF_DISCOUNT_KEY);
  localStorage.removeItem(AFF_CODE_KEY);
  localStorage.removeItem(AFF_EXPIRES_KEY);
}

export function AffiliateTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (!refCode) return;

    const existing = localStorage.getItem(AFF_TOKEN_KEY);
    if (existing) return;

    apiRequest("POST", "/api/affiliate/click", { code: refCode })
      .then(res => res.json())
      .then(data => {
        if (data.sessionToken) {
          localStorage.setItem(AFF_TOKEN_KEY, data.sessionToken);
          localStorage.setItem(AFF_DISCOUNT_KEY, String(data.discount));
          localStorage.setItem(AFF_CODE_KEY, refCode.toLowerCase());
          localStorage.setItem(AFF_EXPIRES_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
        }
      })
      .catch(() => {});

    const url = new URL(window.location.href);
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  return null;
}
