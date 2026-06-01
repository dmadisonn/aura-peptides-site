import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin } from "lucide-react";

interface AddressResult {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: AddressResult) => void;
  className?: string;
  placeholder?: string;
}

declare global {
  interface Window {
    google: any;
    _googleMapsLoaded: boolean;
    _googleMapsCallbacks: (() => void)[];
    _googleMapsError: boolean;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window._googleMapsError) {
      reject(new Error("Google Maps failed to load"));
      return;
    }

    if (window._googleMapsLoaded && window.google?.maps?.places) {
      resolve();
      return;
    }

    if (!window._googleMapsCallbacks) {
      window._googleMapsCallbacks = [];
    }
    window._googleMapsCallbacks.push(() => {
      if (window.google?.maps?.places) {
        resolve();
      } else {
        reject(new Error("Google Maps Places API not available"));
      }
    });

    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=_onGoogleMapsLoad`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      window._googleMapsError = true;
      reject(new Error("Google Maps script failed to load"));
    };

    (window as any)._onGoogleMapsLoad = () => {
      window._googleMapsLoaded = true;
      window._googleMapsCallbacks?.forEach((cb) => cb());
      window._googleMapsCallbacks = [];
    };

    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  className = "",
  placeholder = "Start typing an address...",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    fetch("/api/config/google-maps-key")
      .then((res) => res.json())
      .then((data) => {
        if (data.key) {
          setApiKey(data.key);
        } else {
          setHasKey(false);
        }
      })
      .catch(() => setHasKey(false));
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMaps(apiKey)
      .then(() => setIsLoaded(true))
      .catch(() => setHasKey(false));
  }, [apiKey]);

  const initAutocomplete = useCallback(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      if (!window.google?.maps?.places?.Autocomplete) {
        setHasKey(false);
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["address_components", "formatted_address"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        const components = place.address_components;
        const get = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name || "";
        const getShort = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.short_name || "";

        const streetNumber = get("street_number");
        const route = get("route");
        const subpremise = get("subpremise");

        const result: AddressResult = {
          line1: `${streetNumber} ${route}`.trim(),
          line2: subpremise || "",
          city: get("locality") || get("sublocality") || get("administrative_area_level_2"),
          state: getShort("administrative_area_level_1"),
          zip: get("postal_code"),
        };

        onChange(result.line1);
        onSelect(result);
      });

      autocompleteRef.current = autocomplete;
    } catch {
      setHasKey(false);
    }
  }, [isLoaded, onChange, onSelect]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  if (!hasKey) {
    return (
      <input
        type="text"
        placeholder="Street address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        data-testid="input-shipping-line1"
      />
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        data-testid="input-shipping-line1"
        autoComplete="off"
      />
      {isLoaded && (
        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      )}
    </div>
  );
}
