import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, LogOut, Package, Search, Upload, X, Image as ImageIcon, ShoppingCart, DollarSign, Clock, FileText, FileImage, Check, ZoomIn, ZoomOut, Download, Settings, Truck, MapPin, Users, Mail, Phone, Eye, Hash, Send, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2 as Loader, ExternalLink, FlaskConical, RotateCcw, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import { PdfThumbnail } from "@/components/pdf-thumbnail";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, clearAdminToken, queryClient, getAdminToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlags, type FeatureFlags } from "@/hooks/use-feature-flags";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Product, Order, Certificate, ShippingOption, Customer, EmailLog, Affiliate, AdminTabKey, AdminPermissions, SettingsSectionKey } from "@shared/schema";
import { ADMIN_TAB_KEYS, SETTINGS_SECTION_KEYS, SETTINGS_SECTION_DEFINITIONS } from "@shared/schema";
import { Link2 } from "lucide-react";

type AdminSessionUser = {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  permissions: AdminPermissions;
};

type AdminUserRecord = {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  permissions: AdminPermissions;
};

const TAB_DEFINITIONS: { key: AdminTabKey; label: string; description: string }[] = [
  { key: "products", label: "Products", description: "Manage product catalog & inventory" },
  { key: "orders", label: "Orders", description: "View, fulfill, and invoice orders" },
  { key: "customers", label: "Customers", description: "Customer list & newsletter subscribers" },
  { key: "certificates", label: "Certificates", description: "Manage Certificates of Analysis" },
  { key: "emails", label: "Emails", description: "Email templates, logs, and SMTP settings" },
  { key: "affiliates", label: "Affiliates", description: "Affiliate program management" },
  { key: "settings", label: "Settings", description: "Site config, shipping, payments, feature flags" },
  { key: "users", label: "Users", description: "Manage admin users & roles (super-admin only)" },
];

const ASSIGNABLE_TABS: AdminTabKey[] = ADMIN_TAB_KEYS.filter((k) => k !== "users");

const TAB_ICONS: Record<AdminTabKey, any> = {
  products: Package,
  orders: ShoppingCart,
  customers: Users,
  certificates: FileImage,
  emails: Mail,
  affiliates: Link2,
  settings: Settings,
  users: ShieldCheck,
};

function tabLabel(key: AdminTabKey): string {
  return TAB_DEFINITIONS.find((t) => t.key === key)?.label ?? key;
}

function getVisibleTabs(
  user: AdminSessionUser,
  flags: FeatureFlags,
): { key: AdminTabKey; label: string }[] {
  if (user.isSuperAdmin) {
    return TAB_DEFINITIONS.map((t) => ({ key: t.key, label: t.label }));
  }
  const flagAllowsTab = (key: AdminTabKey): boolean => {
    if (key === "emails") return flags.emails;
    if (key === "affiliates") return flags.affiliates;
    return true;
  };
  const allowed = new Set(user.permissions?.tabs ?? []);
  return TAB_DEFINITIONS
    .filter((t) => t.key !== "users" && allowed.has(t.key) && flagAllowsTab(t.key))
    .map((t) => ({ key: t.key, label: t.label }));
}

function ImageUpload({
  currentUrl,
  onImageChange,
  productName,
  productContents,
}: {
  currentUrl: string;
  onImageChange: (url: string) => void;
  productName?: string;
  productContents?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const flags = useFeatureFlags();
  const { data: session } = useQuery<{ user: AdminSessionUser } | null>({
    queryKey: ["/api/admin/session"],
  });
  const isSuper = !!session?.user?.isSuperAdmin;
  const aiEnabled = isSuper || flags.aiImage;

  const handleGenerate = useCallback(async () => {
    if (!productName?.trim() || !productContents?.trim()) {
      toast({
        title: "Missing product info",
        description: "Fill in the Name and Contents fields before generating an image.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-product-image", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: productName, contents: productContents }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Generation failed");
      }
      const data = await res.json();
      onImageChange(data.imageUrl);
      toast({ title: "AI image generated", description: "Vial mockup ready." });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [productName, productContents, onImageChange, toast]);

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PNG, JPG, and WEBP images are allowed here. For PDFs, use the COA upload section.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const adminToken = getAdminToken();
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: adminToken ? { "x-admin-token": adminToken } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      const data = await res.json();
      onImageChange(data.imageUrl);
      toast({ title: "Image uploaded" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [onImageChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div className="space-y-2">
      <Label className="text-xs mb-1.5 block">Product Image</Label>
      <div
        className={`relative border-2 border-dashed rounded-md p-4 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {currentUrl ? (
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-md overflow-hidden bg-muted/30 shrink-0">
              <img src={currentUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs text-muted-foreground truncate">{currentUrl}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || generating}
                  data-testid="button-change-image"
                >
                  <Upload className="mr-1.5 h-3 w-3" />
                  {uploading ? "Uploading..." : "Change"}
                </Button>
                {aiEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating || uploading}
                    data-testid="button-generate-image"
                  >
                    {generating ? (
                      <Loader className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <ImageIcon className="mr-1.5 h-3 w-3" />
                    )}
                    {generating ? "Generating..." : "Generate AI Image"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onImageChange("")}
                  data-testid="button-remove-image"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <div
              className="cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">
                {uploading ? "Uploading..." : "Drop an image here or click to browse"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG, WEBP, GIF up to 5MB</p>
            </div>
            {aiEnabled && (
              <div className="flex items-center gap-2 justify-center">
                <span className="text-[10px] text-muted-foreground/60">or</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating || uploading}
                  data-testid="button-generate-image"
                >
                  {generating ? (
                    <Loader className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-1.5 h-3 w-3" />
                  )}
                  {generating ? "Generating vial..." : "Generate AI Vial Image"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
        data-testid="input-image-file"
      />
      <div className="flex items-center gap-2">
        <Input
          value={currentUrl}
          onChange={(e) => onImageChange(e.target.value)}
          placeholder="/images/product.png or upload above"
          className="text-xs"
          data-testid="input-product-image-url"
        />
      </div>
    </div>
  );
}

function CoaUploadField({ currentUrl, onUrlChange }: { currentUrl: string; onUrlChange: (url: string) => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Only PDF, PNG, or JPG files allowed.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-coa", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onUrlChange(data.fileUrl);
      toast({ title: "COA uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Input
          value={currentUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://... or upload a PDF/image below"
          className="text-xs"
        />
        {currentUrl && (
          <a href={currentUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" size="sm" variant="outline" className="shrink-0 text-xs px-2">View</Button>
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        <Button type="button" size="sm" variant="outline" className="text-xs"
          onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="mr-1.5 h-3 w-3" />
          {uploading ? "Uploading..." : "Upload PDF or Image"}
        </Button>
        {currentUrl && (
          <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground"
            onClick={() => onUrlChange("")}>Clear</Button>
        )}
      </div>
    </div>
  );
}

function ProductForm({
  product,
  onSuccess,
}: {
  product?: Product;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    subtitle: product?.subtitle ?? "",
    description: product?.description ?? "",
    price: product?.price ? (product.price / 100).toFixed(2) : "",
    contents: product?.contents ?? "",
    imageUrl: product?.imageUrl ?? "",
    category: product?.category ?? "peptide",
    inStock: product?.inStock ?? true,
    featured: product?.featured ?? false,
    researchHighlights: product?.researchHighlights?.join("\n") ?? "",
    coaUrl: product?.coaUrl ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        subtitle: form.subtitle,
        description: form.description,
        price: Math.round(parseFloat(form.price) * 100),
        contents: form.contents,
        imageUrl: form.imageUrl,
        category: form.category,
        inStock: form.inStock,
        featured: form.featured,
        researchHighlights: form.researchHighlights
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        coaUrl: form.coaUrl || null,
      };

      if (isEdit) {
        await apiRequest("PATCH", `/api/admin/products/${product.id}`, body);
      } else {
        await apiRequest("POST", "/api/admin/products", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      toast({ title: isEdit ? "Product updated" : "Product created" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs mb-1.5 block">Name</Label>
          <Input
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) });
            }}
            required
            data-testid="input-product-name"
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            required
            data-testid="input-product-slug"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Subtitle</Label>
        <Input
          value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          placeholder="e.g., The Recovery Peptide"
          required
          data-testid="input-product-subtitle"
        />
      </div>

      <div>
        <Label className="text-xs mb-1.5 block">Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="min-h-[100px]"
          required
          data-testid="input-product-description"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs mb-1.5 block">Price ($)</Label>
          <Input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required
            data-testid="input-product-price"
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Contents</Label>
          <Input
            value={form.contents}
            onChange={(e) => setForm({ ...form, contents: e.target.value })}
            placeholder="e.g., 10mg lyophilized vial"
            required
            data-testid="input-product-contents"
          />
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Category</Label>
          <Select
            value={form.category}
            onValueChange={(v) => setForm({ ...form, category: v })}
          >
            <SelectTrigger data-testid="select-product-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="peptide">Peptide</SelectItem>
              <SelectItem value="blend">Blend</SelectItem>
              <SelectItem value="stack">Stack</SelectItem>
              <SelectItem value="accessory">Accessory</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ImageUpload
        currentUrl={form.imageUrl}
        onImageChange={(url) => setForm({ ...form, imageUrl: url })}
        productName={form.name}
        productContents={form.contents}
      />

      <div>
        <div>
          <Label className="text-xs mb-1.5 block">COA / Document URL</Label>
          <CoaUploadField
            currentUrl={form.coaUrl}
            onUrlChange={(url) => setForm({ ...form, coaUrl: url })}
          />
        </div>

        <Label className="text-xs mb-1.5 block">Research Highlights (one per line)</Label>
        <Textarea
          value={form.researchHighlights}
          onChange={(e) => setForm({ ...form, researchHighlights: e.target.value })}
          placeholder="Enter each highlight on a new line"
          className="min-h-[80px]"
          data-testid="input-product-highlights"
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.inStock}
            onCheckedChange={(v) => setForm({ ...form, inStock: v })}
            data-testid="switch-in-stock"
          />
          <Label className="text-xs">In Stock</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.featured}
            onCheckedChange={(v) => setForm({ ...form, featured: v })}
            data-testid="switch-featured"
          />
          <Label className="text-xs">Featured</Label>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-product">
        {mutation.isPending ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
      </Button>
    </form>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "completed":
    case "picked_up":
    case "paid":
      return "default";
    case "pending":
      return "secondary";
    case "failed":
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

function statusLabel(status: string) {
  if (status === "picked_up") return "Picked Up";
  if (status === "completed") return "Shipped";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const BLANK_ITEM = { name: "", price: "", quantity: 1 };

function CreateManualOrderDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/admin/products"] });

  const blank = {
    email: "", phone: "", name: "",
    line1: "", line2: "", city: "", state: "", zip: "",
    items: [{ ...BLANK_ITEM }] as { name: string; price: string; quantity: number }[],
    shippingLabel: "Standard Shipping", shippingPrice: "",
    status: "paid", sendEmail: true, note: "",
  };
  const [form, setForm] = useState(blank);

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i: number, k: string, v: any) =>
    setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [k]: v }; return { ...f, items }; });
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...BLANK_ITEM }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  const fillFromProduct = (i: number, productId: string) => {
    const p = products?.find(p => p.id === productId);
    if (p) setForm(f => { const items = [...f.items]; items[i] = { name: p.name, price: String(p.price), quantity: 1 }; return { ...f, items }; });
  };

  const productTotal = form.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.quantity, 0);
  const shippingCost = parseFloat(form.shippingPrice) || 0;
  const grandTotal = productTotal + shippingCost;

  const mutation = useMutation({
    mutationFn: async () => {
      const validItems = form.items.filter(i => i.name.trim());
      if (!form.email.trim()) throw new Error("Email is required");
      if (validItems.length === 0) throw new Error("At least one item with a name is required");
      const address = (form.line1 || form.city) ? { line1: form.line1, line2: form.line2, city: form.city, state: form.state, zip: form.zip } : null;
      const res = await apiRequest("POST", "/api/admin/orders", {
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        name: form.name.trim() || null,
        address,
        items: validItems.map(i => ({ name: i.name, price: parseFloat(i.price) || 0, quantity: i.quantity })),
        shippingLabel: form.shippingLabel,
        shippingPrice: parseFloat(form.shippingPrice) || 0,
        status: form.status,
        sendEmail: form.sendEmail,
        note: form.note || null,
      });
      return res.json();
    },
    onSuccess: () => {
      onCreated();
      setOpen(false);
      setForm(blank);
      toast({ title: "Order created successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full" data-testid="button-create-manual-order">
          <Plus className="h-4 w-4 mr-1" />Create Order
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create Manual Order</DialogTitle>
          <p className="text-sm text-muted-foreground">For clinic billing, friends & family, or custom orders.</p>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Customer */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Full Name (for packing slip)</Label>
                <Input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Jane Smith" data-testid="input-manual-name" />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={form.email} onChange={e => setField("email", e.target.value)} placeholder="jane@example.com" data-testid="input-manual-email" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="(555) 000-0000" data-testid="input-manual-phone" />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Shipping Address <span className="font-normal normal-case">(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Address Line 1</Label>
                <Input autoComplete="off" value={form.line1} onChange={e => setField("line1", e.target.value)} placeholder="123 Main St" data-testid="input-manual-line1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Address Line 2</Label>
                <Input autoComplete="off" value={form.line2} onChange={e => setField("line2", e.target.value)} placeholder="Apt, Suite, etc." data-testid="input-manual-line2" />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input autoComplete="off" value={form.city} onChange={e => setField("city", e.target.value)} data-testid="input-manual-city" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">State (abbr.)</Label>
                  <Input autoComplete="off" value={form.state} onChange={e => setField("state", e.target.value)} placeholder="TX" data-testid="input-manual-state" />
                </div>
                <div>
                  <Label className="text-xs">ZIP</Label>
                  <Input autoComplete="off" value={form.zip} onChange={e => setField("zip", e.target.value)} placeholder="78701" data-testid="input-manual-zip" />
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items *</p>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs">Product / Description</Label>
                    <div className="flex gap-1">
                      <Input value={item.name} onChange={e => setItem(i, "name", e.target.value)} placeholder="Custom item name…" className="flex-1" data-testid={`input-manual-item-name-${i}`} />
                      {products && products.length > 0 && (
                        <select
                          className="border rounded-md text-xs px-2 bg-background text-foreground shrink-0 h-10"
                          value=""
                          onChange={e => fillFromProduct(i, e.target.value)}
                          data-testid={`select-manual-item-product-${i}`}
                        >
                          <option value="">Catalog…</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="w-24 shrink-0">
                    <Label className="text-xs">Price ($)</Label>
                    <Input type="number" min="0" step="0.01" value={item.price} onChange={e => setItem(i, "price", e.target.value)} placeholder="0.00" data-testid={`input-manual-item-price-${i}`} />
                  </div>
                  <div className="w-16 shrink-0">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min="1" value={item.quantity} onChange={e => setItem(i, "quantity", parseInt(e.target.value) || 1)} data-testid={`input-manual-item-qty-${i}`} />
                  </div>
                  <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 mb-0.5" onClick={() => removeItem(i)} disabled={form.items.length === 1} data-testid={`button-manual-remove-item-${i}`}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={addItem} data-testid="button-manual-add-item">
                <Plus className="h-3 w-3 mr-1" />Add Item
              </Button>
            </div>
          </div>

          {/* Shipping */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Shipping</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Shipping Method Label</Label>
                <Input value={form.shippingLabel} onChange={e => setField("shippingLabel", e.target.value)} placeholder="Standard Shipping" data-testid="input-manual-shipping-label" />
              </div>
              <div>
                <Label className="text-xs">Shipping Cost ($) — leave blank for free</Label>
                <Input type="number" min="0" step="0.01" value={form.shippingPrice} onChange={e => setField("shippingPrice", e.target.value)} placeholder="0.00" data-testid="input-manual-shipping-price" />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <Label className="text-xs">Internal Note (not shown to customer)</Label>
            <Input value={form.note} onChange={e => setField("note", e.target.value)} placeholder="e.g. Clinic billing, friends & family discount…" data-testid="input-manual-note" />
          </div>

          {/* Status + Email */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs">Payment Status</Label>
              <select
                className="w-full border rounded-md text-sm px-3 h-10 bg-background text-foreground"
                value={form.status}
                onChange={e => setField("status", e.target.value)}
                data-testid="select-manual-status"
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="completed">Shipped</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={form.sendEmail} onCheckedChange={v => setField("sendEmail", v)} data-testid="switch-manual-send-email" />
              <Label className="text-xs">Send confirmation email</Label>
            </div>
          </div>

          {/* Total + Submit */}
          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Subtotal: <span className="font-medium text-foreground">${productTotal.toFixed(2)}</span></p>
              {shippingCost > 0 && <p className="text-xs text-muted-foreground">Shipping: <span className="font-medium text-foreground">${shippingCost.toFixed(2)}</span></p>}
              <p className="text-sm font-bold text-foreground">Total: ${grandTotal.toFixed(2)}</p>
            </div>
            <Button className="rounded-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.email || form.items.every(i => !i.name.trim())} data-testid="button-manual-create">
              {mutation.isPending ? <Loader className="h-4 w-4 animate-spin mr-1" /> : null}Create Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrdersPanel() {
  const { toast } = useToast();
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [carrierInputs, setCarrierInputs] = useState<Record<string, string>>({});

  const filteredOrders = (orders ?? []).filter((o) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "invoice") return (o as any).paymentMethod === "invoice" && o.status === "pending";
    return o.status === statusFilter;
  });

  const totalRevenue = (orders ?? [])
    .filter((o) => o.status === "completed" || o.status === "paid" || o.status === "picked_up")
    .reduce((sum, o) => sum + o.total, 0);

  const orderCount = orders?.length ?? 0;

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status, trackingNumber, carrier }: { id: string; status?: string; trackingNumber?: string; carrier?: string }) => {
      await apiRequest("PATCH", `/api/admin/orders/${id}`, { status, trackingNumber, carrier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold" data-testid="stat-orders-total">{orderCount}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600" data-testid="stat-revenue">${totalRevenue}</p>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600" data-testid="stat-invoice-pending">
            {(orders ?? []).filter((o) => (o as any).paymentMethod === "invoice" && o.status === "pending").length}
          </p>
          <p className="text-xs text-muted-foreground">Invoice Pending</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary" data-testid="stat-pending-orders">
            {(orders ?? []).filter((o) => o.status === "paid").length}
          </p>
          <p className="text-xs text-muted-foreground">Needs Shipping</p>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-order-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="completed">Shipped</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="invoice">Invoice Pending</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Showing {filteredOrders.length} of {orderCount} orders
        </p>
        <div className="ml-auto">
          <CreateManualOrderDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] })} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {statusFilter !== "all"
              ? "No orders match this filter."
              : "No orders yet."}
          </p>
          {statusFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setStatusFilter("all")}
              data-testid="button-clear-order-filter"
            >
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => {
            const items = order.items as Array<{ name: string; quantity: number; price: number; isShipping?: boolean }>;
            const addr = order.shippingAddress as { name?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string; country?: string; pickup?: boolean; location?: string } | null;
            const productItems = items.filter(i => !i.isShipping);
            const isPickup = addr?.pickup === true;
            const itemCount = productItems.reduce((sum, i) => sum + i.quantity, 0);
            const paymentMethod = (order as any).paymentMethod as string | null;
            const isInvoiceOrder = paymentMethod === "invoice";
            const isManualOrder = !order.stripeSessionId && !paymentMethod;
            return (
              <Dialog key={order.id}>
                <DialogTrigger asChild>
                  <button
                    className={`w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer ${isInvoiceOrder && order.status === "pending" ? "border-amber-300 dark:border-amber-700" : ""}`}
                    data-testid={`card-order-${order.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm truncate" data-testid={`text-order-email-${order.id}`}>
                            {order.email}
                          </span>
                          <Badge variant={statusColor(order.status)} className="text-[10px] shrink-0">
                            {statusLabel(order.status)}
                          </Badge>
                          {isInvoiceOrder && (
                            <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                              Invoice
                            </Badge>
                          )}
                          {isManualOrder && (
                            <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
                              Manual
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(order.createdAt)}</span>
                          <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                          <span className="flex items-center gap-1">
                            {isPickup ? <MapPin className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                            {isPickup ? "Pickup" : "Shipping"}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold shrink-0" data-testid={`text-order-total-${order.id}`}>
                        ${order.total}
                      </span>
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                </DialogTrigger>
                <OrderDetailDialog
                  order={order}
                  items={items}
                  addr={addr}
                  trackingInputs={trackingInputs}
                  setTrackingInputs={setTrackingInputs}
                  carrierInputs={carrierInputs}
                  setCarrierInputs={setCarrierInputs}
                  updateOrderMutation={updateOrderMutation}
                />
              </Dialog>
            );
          })}
        </div>
      )}
    </>
  );
}

function OrderDetailDialog({
  order,
  items,
  addr,
  trackingInputs,
  setTrackingInputs,
  carrierInputs,
  setCarrierInputs,
  updateOrderMutation,
}: {
  order: Order;
  items: Array<{ name: string; quantity: number; price: number; isShipping?: boolean }>;
  addr: { name?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string; country?: string; pickup?: boolean; location?: string } | null;
  trackingInputs: Record<string, string>;
  setTrackingInputs: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  carrierInputs: Record<string, string>;
  setCarrierInputs: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  updateOrderMutation: any;
}) {
  const { toast } = useToast();
  const flags = useFeatureFlags();
  const { data: session } = useQuery<{ user: AdminSessionUser } | null>({
    queryKey: ["/api/admin/session"],
  });
  const isSuper = !!session?.user?.isSuperAdmin;
  const productItems = items.filter(i => !i.isShipping);
  const shippingItem = items.find(i => i.isShipping);
  const isPickup = addr?.pickup === true;
  const trackingVal = trackingInputs[order.id] ?? (order.trackingNumber || "");
  const carrierVal = carrierInputs[order.id] ?? ((order as any).carrier || "");
  const paymentMethod = (order as any).paymentMethod as string | null;
  const isInvoiceOrder = paymentMethod === "invoice";

  const sendInvoiceMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/orders/${order.id}/send-invoice`, {}),
    onSuccess: () => toast({ title: "Invoice sent to " + order.email }),
    onError: (e: Error) => toast({ title: "Failed to send invoice", description: e.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/orders/${order.id}/mark-paid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order marked as paid" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-base">Order Details</DialogTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant={statusColor(order.status)} className="text-[10px]">
            {statusLabel(order.status)}
          </Badge>
          {isInvoiceOrder && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              Invoice
            </Badge>
          )}
          {paymentMethod === "manual" && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Manual</Badge>
          )}
          {(isSuper || flags.packingSlip) && (
            <button
              onClick={() => window.open(`/api/admin/orders/${order.id}/packing-slip`, "_blank")}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border bg-background hover:bg-muted transition-colors"
              data-testid={`button-packing-slip-${order.id}`}
              title="Open packing slip PDF"
            >
              <FileText className="h-3 w-3" />
              Packing Slip
            </button>
          )}
          {(isSuper || flags.reconstitutionGuide) && (
            <button
              onClick={() => window.open(`/api/admin/reconstitution-guide`, "_blank")}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border bg-background hover:bg-muted transition-colors"
              data-testid={`button-reconstitution-guide-${order.id}`}
              title="Open reconstitution guide PDF"
            >
              <FlaskConical className="h-3 w-3" />
              Reconstitution Guide
            </button>
          )}
        </div>

        {/* Invoice / Payment actions */}
        {(isInvoiceOrder || order.status === "pending") && (
          <div className="flex flex-wrap gap-2 pt-2 mt-1 border-t border-amber-200 dark:border-amber-800">
            {isInvoiceOrder && (
              <button
                onClick={() => sendInvoiceMutation.mutate()}
                disabled={sendInvoiceMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
                data-testid={`button-send-invoice-${order.id}`}
              >
                <Send className="h-3 w-3" />
                {sendInvoiceMutation.isPending ? "Sending..." : "Send Invoice Email"}
              </button>
            )}
            {order.status === "pending" && (
              <button
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
                data-testid={`button-mark-paid-${order.id}`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {markPaidMutation.isPending ? "Updating..." : "Mark as Paid"}
              </button>
            )}
          </div>
        )}
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span data-testid={`text-detail-email-${order.id}`}>{order.email}</span>
          </div>
          {order.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{order.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDate(order.createdAt)}</span>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Items</p>
          <div className="space-y-1.5">
            {productItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                <span className="font-medium">${item.price * item.quantity}</span>
              </div>
            ))}
            {shippingItem && (
              <div className="flex items-center justify-between text-sm border-t pt-1.5 mt-1.5">
                <span className="text-muted-foreground italic">{shippingItem.name}</span>
                <span className="font-medium">{shippingItem.price === 0 ? "Free" : `$${shippingItem.price}`}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-sm font-bold border-t pt-2 mt-2">
            <span>Total</span>
            <span data-testid={`text-detail-total-${order.id}`}>${order.total}</span>
          </div>
        </div>

        {addr && !isPickup && addr.line1 && (
          <div className="border-t pt-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Ship To
            </p>
            <div className="text-sm space-y-0.5">
              <p className="font-medium">{addr.name}</p>
              <p className="text-muted-foreground">{addr.line1}</p>
              {addr.line2 && <p className="text-muted-foreground">{addr.line2}</p>}
              <p className="text-muted-foreground">{addr.city}, {addr.state} {addr.zip}</p>
            </div>
          </div>
        )}

        {addr && isPickup && (
          <div className="border-t pt-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Local Pickup
            </p>
            <p className="text-sm text-muted-foreground">{addr.location}</p>
          </div>
        )}

        {order.trackingNumber && order.status === "completed" && (() => {
          const carrier = (order as any).carrier || "";
          const carrierLabel = carrier === "usps" ? "USPS" : carrier === "ups" ? "UPS" : carrier === "fedex" ? "FedEx" : carrier === "dhl" ? "DHL" : carrier ? carrier.toUpperCase() : "";
          let trackingUrl = "";
          if (carrier === "usps") trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingNumber}`;
          else if (carrier === "ups") trackingUrl = `https://www.ups.com/track?tracknum=${order.trackingNumber}`;
          else if (carrier === "fedex") trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${order.trackingNumber}`;
          else if (carrier === "dhl") trackingUrl = `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${order.trackingNumber}`;
          return (
            <div className="border-t pt-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {carrierLabel ? `${carrierLabel} Tracking` : "Tracking Number"}
              </p>
              {trackingUrl ? (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono font-medium text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-1.5"
                  data-testid={`link-tracking-${order.id}`}
                >
                  {order.trackingNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-sm font-mono font-medium">{order.trackingNumber}</p>
              )}
            </div>
          );
        })()}

        <div className="border-t pt-3 space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Update Order</p>
          <select
            value={trackingInputs[order.id + "_status"] ?? order.status}
            onChange={(e) => setTrackingInputs((prev: Record<string, string>) => ({ ...prev, [order.id + "_status"]: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid={`select-status-${order.id}`}
          >
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            {isPickup ? (
              <option value="picked_up">Picked Up</option>
            ) : (
              <option value="completed">Shipped</option>
            )}
            <option value="cancelled">Cancelled</option>
          </select>

          {!isPickup && (
            <>
              <select
                value={carrierVal}
                onChange={(e) => setCarrierInputs((prev: Record<string, string>) => ({ ...prev, [order.id]: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid={`select-carrier-${order.id}`}
              >
                <option value="">Select carrier...</option>
                <option value="usps">USPS</option>
                <option value="ups">UPS</option>
                <option value="fedex">FedEx</option>
                <option value="dhl">DHL</option>
              </select>
              <input
                type="text"
                placeholder="Tracking number (optional)"
                value={trackingVal}
                onChange={(e) => setTrackingInputs((prev: Record<string, string>) => ({ ...prev, [order.id]: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid={`input-tracking-${order.id}`}
              />
            </>
          )}

          <Button
            size="sm"
            className="w-full"
            disabled={updateOrderMutation.isPending}
            onClick={() => {
              const newStatus = trackingInputs[order.id + "_status"] ?? order.status;
              updateOrderMutation.mutate({
                id: order.id,
                status: newStatus,
                trackingNumber: !isPickup ? (trackingVal || undefined) : undefined,
                carrier: !isPickup ? (carrierVal || undefined) : undefined,
              });
            }}
            data-testid={`button-update-order-${order.id}`}
          >
            <Check className="mr-2 h-3.5 w-3.5" />
            {updateOrderMutation.isPending ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function CertificatesPanel() {
  const { toast } = useToast();
  const { data: certificates, isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
  });
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [viewCert, setViewCert] = useState<Certificate | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (viewCert) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [viewCert]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/certificates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Certificate deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await apiRequest("PATCH", `/api/admin/certificates/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Title updated" });
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name.replace(/\.[^/.]+$/, ""));
      const adminToken = getAdminToken();
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: adminToken ? { "x-admin-token": adminToken } : {},
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Upload failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Certificate uploaded" });
      setTitle("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const certCount = certificates?.length ?? 0;

  return (
    <>
      <Card className="p-4 mb-6">
        <p className="text-sm font-medium mb-3">Upload Certificate of Analysis</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
            <Input
              placeholder="e.g. BPC-157 CoA Batch #2024"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-coa-title"
            />
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
              data-testid="input-coa-file"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="button-upload-coa"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Supports PNG, JPG, WEBP, GIF, and PDF files up to 10MB
        </p>
      </Card>

      <p className="text-xs text-muted-foreground mb-4">
        {certCount} certificate{certCount !== 1 ? "s" : ""} uploaded
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-md" />
          ))}
        </div>
      ) : certCount === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">No certificates uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {certificates!.map((cert) => (
            <Card key={cert.id} className="overflow-visible relative group" data-testid={`card-coa-${cert.id}`}>
              <button
                className="block w-full"
                onClick={() => { setViewCert(cert); setZoomed(false); }}
              >
                {cert.fileType === "image" ? (
                  <div className="aspect-[3/4] overflow-hidden rounded-t-md">
                    <img
                      src={cert.fileUrl}
                      alt={cert.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <PdfThumbnail thumbnailUrl={cert.thumbnailUrl} />
                )}
              </button>
              <div className="p-2">
                {editingId === cert.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateTitleMutation.mutate({ id: cert.id, title: editTitle });
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      data-testid={`input-edit-coa-title-${cert.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => updateTitleMutation.mutate({ id: cert.id, title: editTitle })}
                      disabled={updateTitleMutation.isPending}
                      data-testid={`button-save-coa-title-${cert.id}`}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      data-testid={`button-cancel-coa-title-${cert.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-medium truncate flex-1">{cert.title}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setEditingId(cert.id); setEditTitle(cert.title); }}
                      data-testid={`button-edit-coa-title-${cert.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-delete-coa-${cert.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this certificate?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove "{cert.title}" from the gallery.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(cert.id)} data-testid={`button-confirm-delete-coa-${cert.id}`}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewCert && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex flex-col"
          onClick={() => { setViewCert(null); setZoomed(false); }}
          data-testid="admin-coa-lightbox"
        >
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-white text-sm font-medium truncate mr-4 max-w-[60%]">
              {viewCert.title}
            </p>
            <div className="flex items-center gap-2">
              {viewCert.fileType === "image" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/80 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                  data-testid="button-admin-zoom-toggle"
                >
                  {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
                </Button>
              )}
              {isMobile && viewCert.fileType === "pdf" && viewCert.thumbnailUrl && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/80 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                  data-testid="button-admin-zoom-toggle"
                >
                  {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
                </Button>
              )}
              <a
                href={viewCert.fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/80 hover:text-white"
                  data-testid="button-admin-download-coa"
                >
                  <Download className="h-5 w-5" />
                </Button>
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="text-white/80 hover:text-white"
                onClick={() => { setViewCert(null); setZoomed(false); }}
                data-testid="button-admin-close-lightbox"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto flex items-start sm:items-center justify-center px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            {viewCert.fileType === "pdf" && !isMobile ? (
              <iframe
                src={viewCert.fileUrl}
                title={viewCert.title}
                className="w-full h-[calc(100vh-5rem)] max-w-4xl rounded-md bg-white"
                data-testid="iframe-admin-coa-preview"
              />
            ) : viewCert.fileType === "image" ? (
              <img
                src={viewCert.fileUrl}
                alt={viewCert.title}
                className={`rounded-md bg-white transition-transform duration-200 ${
                  zoomed
                    ? "max-w-none w-[150vw] sm:w-[120vw] cursor-zoom-out"
                    : "max-w-full max-h-[calc(100vh-5rem)] w-auto h-auto object-contain cursor-zoom-in"
                }`}
                onClick={() => setZoomed(!zoomed)}
                data-testid="img-admin-coa-preview"
              />
            ) : viewCert.thumbnailUrl ? (
              <img
                src={viewCert.thumbnailUrl}
                alt={viewCert.title}
                className={`rounded-md bg-white transition-transform duration-200 ${
                  zoomed
                    ? "max-w-none w-[150vw] cursor-zoom-out"
                    : "max-w-full max-h-[calc(100vh-5rem)] w-auto h-auto object-contain cursor-zoom-in"
                }`}
                onClick={() => setZoomed(!zoomed)}
                data-testid="img-admin-coa-preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <FileText className="h-16 w-16 text-white/40 mb-4" />
                <p className="text-white/60 text-sm mb-4">Preview not available</p>
                <a
                  href={viewCert.fileUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="bg-white/10 backdrop-blur text-white border-white/20">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FeatureToggles() {
  const { toast } = useToast();
  const { data: flags } = useQuery<FeatureFlags>({
    queryKey: ["/api/feature-flags"],
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<FeatureFlags>) => {
      await apiRequest("PATCH", "/api/admin/feature-flags", update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags"] });
      toast({ title: "Feature toggles updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const items: {
    key: keyof FeatureFlags;
    label: string;
    description: string;
  }[] = [
    {
      key: "emails",
      label: "Transactional emails",
      description: "Order confirmations, shipping updates, password resets, contact form, affiliate notifications.",
    },
    {
      key: "affiliates",
      label: "Affiliate program",
      description: "Public /affiliates page, the announcement banner, and the storefront nav link.",
    },
    {
      key: "aiImage",
      label: "AI image generator",
      description: "The Generate AI Vial Image button in the product editor.",
    },
    {
      key: "packingSlip",
      label: "Packing slip generator",
      description: "The Packing Slip PDF button on each order.",
    },
    {
      key: "reconstitutionGuide",
      label: "Reconstitution guide",
      description: "The Reconstitution Guide PDF button on each order.",
    },
  ];

  return (
    <Card className="p-5 mb-6">
      <h3 className="text-sm font-semibold mb-1">Feature Toggles</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Turn entire features on or off. Disabled features stop running on both the storefront and the server.
      </p>
      <div className="space-y-4">
        {items.map((item) => {
          const checked = flags?.[item.key] ?? true;
          return (
            <div key={item.key} className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Label className="text-sm font-medium" htmlFor={`toggle-${item.key}`}>
                  {item.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                id={`toggle-${item.key}`}
                checked={checked}
                onCheckedChange={(value) => mutation.mutate({ [item.key]: value })}
                disabled={!flags || mutation.isPending}
                data-testid={`switch-feature-${item.key}`}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PaymentMethodSettings() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ stripeEnabled: boolean; invoiceEnabled: boolean }>({
    queryKey: ["/api/settings/payment-methods"],
  });

  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [invoiceEnabled, setInvoiceEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setStripeEnabled(data.stripeEnabled);
      setInvoiceEnabled(data.invoiceEnabled);
      setInitialized(true);
    }
  }, [data, initialized]);

  const saveMutation = useMutation({
    mutationFn: async (update: { stripeEnabled?: boolean; invoiceEnabled?: boolean }) => {
      await apiRequest("PATCH", "/api/admin/settings/payment-methods", update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/payment-methods"] });
      toast({ title: "Payment settings updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleStripeToggle = (val: boolean) => {
    setStripeEnabled(val);
    saveMutation.mutate({ stripeEnabled: val });
  };

  const handleInvoiceToggle = (val: boolean) => {
    setInvoiceEnabled(val);
    saveMutation.mutate({ invoiceEnabled: val });
  };

  if (isLoading) return null;

  return (
    <Card className="p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Payment Methods</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Choose which payment options are available to customers at checkout. At least one should be enabled.
      </p>

      <div className="space-y-4">
        {/* Stripe */}
        <div className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${stripeEnabled ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
          <div className="mt-0.5">
            <Switch
              checked={stripeEnabled}
              onCheckedChange={handleStripeToggle}
              disabled={saveMutation.isPending}
              data-testid="switch-stripe-enabled"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Credit / Debit Card</p>
              {stripeEnabled && <Badge variant="default" className="text-[10px] px-1.5">Active</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customers pay immediately via Stripe — Visa, Mastercard, Amex, and more.
            </p>
          </div>
        </div>

        {/* Invoice */}
        <div className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${invoiceEnabled ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-border bg-muted/30"}`}>
          <div className="mt-0.5">
            <Switch
              checked={invoiceEnabled}
              onCheckedChange={handleInvoiceToggle}
              disabled={saveMutation.isPending}
              data-testid="switch-invoice-enabled"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Invoice / Pay Later</p>
              {invoiceEnabled && <Badge variant="outline" className="text-[10px] px-1.5 text-amber-600 border-amber-400">Active</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customers submit an order without paying. You receive an email and manually send them a Square invoice.
            </p>
          </div>
        </div>
      </div>

      {!stripeEnabled && !invoiceEnabled && (
        <p className="text-xs text-destructive mt-3 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          No payment method is active — customers won't be able to check out.
        </p>
      )}
    </Card>
  );
}

function AffiliateBannerSettings() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/affiliate-banner"],
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("PATCH", "/api/admin/settings/affiliate-banner", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/affiliate-banner"] });
      toast({ title: "Affiliate banner updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const enabled = data?.enabled ?? true;

  return (
    <Card className="p-5 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Affiliate Program Banner</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show the sitewide announcement bar promoting the affiliate program.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={isLoading || toggleMutation.isPending}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
          data-testid="switch-affiliate-banner"
        />
      </div>
      <p className={`text-xs mt-3 ${enabled ? "text-green-600" : "text-muted-foreground"}`}>
        {enabled ? "Banner is visible across all store pages." : "Banner is hidden."}
      </p>
    </Card>
  );
}

function FreeShippingSettings() {
  const { toast } = useToast();
  const { data: thresholdData, isLoading } = useQuery<{ threshold: number | null }>({
    queryKey: ["/api/settings/free-shipping-threshold"],
  });
  const [value, setValue] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (thresholdData && !initialized) {
      setValue(thresholdData.threshold ? String(thresholdData.threshold) : "");
      setInitialized(true);
    }
  }, [thresholdData, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const threshold = value.trim() === "" || value === "0" ? 0 : parseInt(value, 10);
      await apiRequest("PATCH", "/api/admin/settings/free-shipping-threshold", { threshold });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/free-shipping-threshold"] });
      toast({ title: "Free shipping threshold updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card className="p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Truck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Free Shipping Promotion</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Set a minimum order amount (in dollars) to qualify for free shipping. Set to 0 or leave blank to disable.
      </p>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <Label className="text-xs">Minimum Order ($)</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0 = disabled"
            data-testid="input-free-shipping-threshold"
          />
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-free-shipping"
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
      {thresholdData?.threshold && thresholdData.threshold > 0 && (
        <p className="text-xs text-green-600 mt-3">
          Active: Free shipping on orders over ${thresholdData.threshold}
        </p>
      )}
    </Card>
  );
}

function EmailSettings() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [provider, setProvider] = useState<"gmail" | "resend">("gmail");
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPass, setGmailPass] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [resendFrom, setResendFrom] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminBcc, setAdminBcc] = useState("");
  const [testEmail, setTestEmail] = useState("");

  const { data: settings } = useQuery<{
    gmailUser: string;
    gmailAppPassword: string;
    hasPassword: boolean;
    adminNotifyEmail: string;
    adminBccEmail: string;
    emailProvider: string;
    resendApiKey: string;
    hasResendKey: boolean;
    resendFromEmail: string;
  }>({
    queryKey: ["/api/admin/email-settings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (settings) {
      setProvider((settings.emailProvider as "gmail" | "resend") || "gmail");
      setGmailUser(settings.gmailUser);
      setGmailPass(settings.gmailAppPassword);
      setResendKey(settings.resendApiKey);
      setResendFrom(settings.resendFromEmail);
      setAdminEmail(settings.adminNotifyEmail);
      setAdminBcc(settings.adminBccEmail || "");
    }
  }, [settings]);

  const isConfigured = provider === "resend" ? settings?.hasResendKey : settings?.hasPassword;

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/admin/email-settings", {
        emailProvider: provider,
        gmailUser,
        gmailAppPassword: gmailPass,
        resendApiKey: resendKey,
        resendFromEmail: resendFrom,
        adminNotifyEmail: adminEmail,
        adminBccEmail: adminBcc,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-settings"] });
      toast({ title: "Email settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const to = testEmail || (provider === "resend" ? resendFrom : gmailUser);
      await apiRequest("POST", "/api/admin/test-email", { email: to });
    },
    onSuccess: () => {
      toast({ title: "Test email sent" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send test email", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card className="p-5 mb-8">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-email-settings"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Email</h3>
          {isConfigured && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-200">
              Configured
            </Badge>
          )}
          {settings && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              {settings.emailProvider === "resend" ? "Resend" : "Gmail"}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <Label className="text-xs">Email Provider</Label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setProvider("gmail")}
                data-testid="button-provider-gmail"
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${provider === "gmail" ? "bg-primary text-white border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}
              >
                Gmail
              </button>
              <button
                type="button"
                onClick={() => setProvider("resend")}
                data-testid="button-provider-resend"
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${provider === "resend" ? "bg-primary text-white border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}
              >
                Resend
              </button>
            </div>
          </div>

          {provider === "gmail" && (
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                Use a Gmail App Password (not your regular password). Generate one at myaccount.google.com → Security → 2-Step Verification → App passwords.
              </p>
              <div>
                <Label className="text-xs">Gmail Address</Label>
                <Input
                  type="email"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="your@gmail.com"
                  data-testid="input-gmail-user"
                />
              </div>
              <div>
                <Label className="text-xs">App Password</Label>
                <Input
                  type="password"
                  value={gmailPass}
                  onChange={(e) => setGmailPass(e.target.value)}
                  placeholder={settings?.hasPassword ? "••••••••" : "16-character app password"}
                  data-testid="input-gmail-password"
                />
              </div>
            </div>
          )}

          {provider === "resend" && (
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                Enter your Resend API key and a verified sender address. Get your API key at resend.com.
              </p>
              <div>
                <Label className="text-xs">Resend API Key</Label>
                <Input
                  type="password"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder={settings?.hasResendKey ? "••••••••" : "re_xxxxxxxxxxxxxxxx"}
                  data-testid="input-resend-api-key"
                />
              </div>
              <div>
                <Label className="text-xs">From Email Address</Label>
                <Input
                  type="email"
                  value={resendFrom}
                  onChange={(e) => setResendFrom(e.target.value)}
                  placeholder="support@yourdomain.com"
                  data-testid="input-resend-from-email"
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Admin Notification Email (optional)</Label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Defaults to sender address above"
              data-testid="input-admin-notify-email"
            />
          </div>

          <div>
            <Label className="text-xs">BCC All Outgoing Emails (optional)</Label>
            <Input
              type="text"
              value={adminBcc}
              onChange={(e) => setAdminBcc(e.target.value)}
              placeholder="archive@example.com"
              data-testid="input-admin-bcc-email"
            />
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              Every email sent from the site (orders, shipping, contact replies, admin notifications, test emails, etc.) will silently BCC this address. Separate multiple addresses with commas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-email-settings"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
            {isConfigured && (
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Test recipient email"
                  className="w-48 h-8 text-xs"
                  data-testid="input-test-email"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  data-testid="button-send-test-email"
                >
                  <Send className="mr-1.5 h-3 w-3" />
                  {testMutation.isPending ? "Sending..." : "Test"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function EmailLogsPanel() {
  const { data: logs, isLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/admin/email-logs"],
  });
  const [filterType, setFilterType] = useState("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const filtered = (logs ?? []).filter((log) => {
    if (filterType === "all") return true;
    return log.templateType === filterType;
  });

  const templateLabel = (type: string) => {
    const labels: Record<string, string> = {
      order_confirmation: "Order Confirmation",
      admin_new_order: "Admin Notification",
      shipped: "Shipped",
      cart_reminder: "Cart Reminder",
      contact_form: "Contact Form",
      test: "Test Email",
    };
    return labels[type] || type;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Email Logs</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} email{filtered.length !== 1 ? "s" : ""} sent</p>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]" data-testid="select-email-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="order_confirmation">Order Confirmation</SelectItem>
            <SelectItem value="admin_new_order">Admin Notification</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="cart_reminder">Cart Reminder</SelectItem>
            <SelectItem value="contact_form">Contact Form</SelectItem>
            <SelectItem value="test">Test Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {filterType !== "all" ? "No emails match this filter." : "No emails have been sent yet. Configure Gmail in Settings to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div key={log.id}>
              <button
                className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                data-testid={`card-email-log-${log.id}`}
              >
                <div className="flex items-center gap-3">
                  {log.status === "sent" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">{log.subject}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {templateLabel(log.templateType)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="truncate">{log.toEmail}</span>
                      <span className="shrink-0">{new Date(log.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  {expandedLog === log.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              </button>
              {expandedLog === log.id && (
                <div className="mt-1 rounded-lg border bg-card overflow-hidden">
                  {log.errorMessage && (
                    <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b">
                      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        <span>{log.errorMessage}</span>
                      </div>
                    </div>
                  )}
                  <div className="p-3">
                    <div className="rounded-md border overflow-hidden">
                      <iframe
                        srcDoc={log.htmlContent}
                        className="w-full h-[400px] border-0"
                        title={`Email preview: ${log.subject}`}
                        sandbox=""
                        data-testid={`iframe-email-preview-${log.id}`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TemplatePreviewPanel() {
  const { toast } = useToast();
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, { subject: string; html: string }>>({});
  const [loadingAll, setLoadingAll] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const templates = [
    { type: "order_confirmation", label: "Order Confirmation", description: "Sent to customers after successful payment" },
    { type: "admin_new_order", label: "Admin Notification", description: "Sent to admin when a new order is placed" },
    { type: "shipped", label: "Shipped", description: "Sent to customers when order is marked shipped" },
    { type: "cart_reminder", label: "Cart Reminder", description: "Sent to customers who abandon their cart" },
    { type: "contact_form", label: "Contact Form Reply", description: "Auto-reply sent to contact form submitters" },
  ];

  const loadAll = async () => {
    setLoadingAll(true);
    const results: Record<string, { subject: string; html: string }> = {};
    await Promise.all(
      templates.map(async (t) => {
        try {
          const res = await fetch(`/api/admin/email-templates/preview/${t.type}`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            results[t.type] = { subject: data.subject, html: data.html };
          }
        } catch {}
      })
    );
    setPreviews(results);
    setLoadingAll(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const sendTest = async () => {
    if (!testEmail || !openTemplate) return;
    setSendingTest(true);
    try {
      const res = await apiRequest("POST", `/api/admin/email-templates/test/${openTemplate}`, { email: testEmail });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      toast({ title: "Test email sent", description: `Sent to ${testEmail}` });
    } catch (error: any) {
      toast({ title: "Failed to send test", description: error.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  const openLabel = templates.find(t => t.type === openTemplate)?.label || "";

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Templates</h2>
          <p className="text-sm text-muted-foreground">Click a template to preview it full-size</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loadingAll} className="rounded-full" data-testid="button-refresh-previews">
          <Loader className={`h-3.5 w-3.5 mr-1.5 ${loadingAll ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loadingAll ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Skeleton key={t.type} className="h-[320px] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const preview = previews[t.type];
            return (
              <Card
                key={t.type}
                className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-primary/20 group"
                onClick={() => setOpenTemplate(t.type)}
                data-testid={`card-template-${t.type}`}
              >
                <div className="relative h-[240px] overflow-hidden border-b bg-[#f5f3ef]">
                  {preview ? (
                    <div className="absolute inset-0 flex justify-center overflow-hidden">
                      <iframe
                        srcDoc={preview.html}
                        className="border-0 pointer-events-none shrink-0"
                        style={{ width: "600px", height: "800px", transform: "scale(0.45)", transformOrigin: "top center" }}
                        title={`Thumbnail: ${t.label}`}
                        sandbox=""
                        tabIndex={-1}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Preview unavailable
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-card/90 rounded-full px-4 py-2 shadow-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm font-medium">Preview</span>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm mb-1">{t.label}</h3>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!openTemplate} onOpenChange={(open) => { if (!open) setOpenTemplate(null); }}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="text-base">{openLabel}</DialogTitle>
            {openTemplate && previews[openTemplate] && (
              <p className="text-sm text-muted-foreground mt-1">Subject: {previews[openTemplate].subject}</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {openTemplate && previews[openTemplate] ? (
              <iframe
                srcDoc={previews[openTemplate].html}
                className="w-full border-0"
                style={{ minHeight: "700px" }}
                title={`Full preview: ${openLabel}`}
                sandbox=""
                data-testid={`iframe-template-preview-${openTemplate}`}
              />
            ) : (
              <div className="flex items-center justify-center py-24">
                <p className="text-muted-foreground text-sm">Preview not available</p>
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t shrink-0 bg-muted/30 flex items-center gap-3">
            <p className="text-xs text-muted-foreground shrink-0">Send test:</p>
            <Input
              placeholder="Email address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") sendTest(); }}
              data-testid="input-test-email-dialog"
            />
            <Button
              size="sm"
              className="rounded-full h-8 shrink-0"
              onClick={sendTest}
              disabled={sendingTest || !testEmail}
              data-testid="button-send-test-dialog"
            >
              {sendingTest ? <Loader className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type NewsletterContact = {
  email: string;
  name: string | null;
  source: string;
  subscribed: boolean;
  subscriberId: string | null;
  customerId: string | null;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
};

function NewsletterPanel() {
  const { toast } = useToast();
  const { data: contacts, isLoading } = useQuery<NewsletterContact[]>({
    queryKey: ["/api/admin/newsletter"],
  });
  const [search, setSearch] = useState("");

  const filtered = (contacts ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.email.toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q);
  });

  const subscribedCount = (contacts ?? []).filter(c => c.subscribed).length;
  const totalCount = (contacts ?? []).length;

  const toggleMutation = useMutation({
    mutationFn: async ({ email, subscribed }: { email: string; subscribed: boolean; customerId?: string | null; subscriberId?: string | null }) => {
      await apiRequest("PATCH", "/api/admin/newsletter/toggle", { email, subscribed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/newsletter/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter"] });
      toast({ title: "Subscriber removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sourceLabel = (source: string) => {
    const labels: Record<string, string> = { website: "Website", customer: "Customer", order: "Order", admin: "Admin" };
    return labels[source] || source;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Newsletter Contacts</h2>
          <p className="text-sm text-muted-foreground">{subscribedCount} subscribed of {totalCount} total</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-newsletter"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search ? "No contacts match your search." : "No newsletter contacts yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <div
              key={contact.email}
              className="flex items-center justify-between rounded-lg border bg-card p-3"
              data-testid={`card-newsletter-${contact.email}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm truncate">{contact.email}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                    {sourceLabel(contact.source)}
                  </Badge>
                  {!contact.subscribed && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                      Unsubscribed
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {contact.name && <span>{contact.name}</span>}
                  {contact.orderCount > 0 && <span>{contact.orderCount} order{contact.orderCount !== 1 ? "s" : ""}</span>}
                  {contact.totalSpent > 0 && <span>${contact.totalSpent}</span>}
                  <span>{new Date(contact.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={contact.subscribed}
                  onCheckedChange={(checked) => toggleMutation.mutate({ email: contact.email, subscribed: checked, customerId: contact.customerId, subscriberId: contact.subscriberId })}
                  data-testid={`switch-subscribe-${contact.email}`}
                />
                {contact.subscriberId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-delete-subscriber-${contact.email}`}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove subscriber?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {contact.email} from the newsletter list. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(contact.subscriberId!)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EmailsPanel() {
  const [emailSubTab, setEmailSubTab] = useState<"logs" | "templates" | "newsletter">("logs");

  return (
    <>
      <div className="flex gap-2 mb-6 border-b">
        {([
          { key: "logs" as const, label: "Logs", icon: FileText },
          { key: "templates" as const, label: "Templates", icon: Eye },
          { key: "newsletter" as const, label: "Newsletter", icon: Users },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              emailSubTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setEmailSubTab(key)}
            data-testid={`tab-email-${key}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {emailSubTab === "logs" ? (
        <EmailLogsPanel />
      ) : emailSubTab === "templates" ? (
        <TemplatePreviewPanel />
      ) : (
        <NewsletterPanel />
      )}
    </>
  );
}

function SettingsPanel() {
  const { toast } = useToast();
  const { data: session } = useQuery<{ user: AdminSessionUser } | null>({
    queryKey: ["/api/admin/session"],
  });
  const isSuper = !!session?.user?.isSuperAdmin;
  const allowedSections = session?.user?.permissions?.settingsSections;
  const canSee = (key: SettingsSectionKey) => {
    if (isSuper) return true;
    if (!allowedSections || allowedSections.length === 0) return true;
    return allowedSections.includes(key);
  };
  const { data: shippingOptions, isLoading } = useQuery<ShippingOption[]>({
    queryKey: ["/api/admin/shipping-options"],
    enabled: canSee("shipping"),
  });
  const [editingOption, setEditingOption] = useState<ShippingOption | null>(null);
  const [addingOption, setAddingOption] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormEnabled(true);
    setEditingOption(null);
    setAddingOption(false);
  };

  const startEdit = (option: ShippingOption) => {
    setEditingOption(option);
    setAddingOption(false);
    setFormName(option.name);
    setFormDescription(option.description || "");
    setFormPrice((option.price / 100).toFixed(2));
    setFormEnabled(option.enabled);
  };

  const startAdd = () => {
    resetForm();
    setAddingOption(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceInCents = Math.round(parseFloat(formPrice || "0") * 100);
      const body = {
        name: formName,
        description: formDescription || null,
        price: priceInCents,
        enabled: formEnabled,
        sortOrder: editingOption?.sortOrder ?? (shippingOptions?.length ?? 0),
      };
      if (editingOption) {
        await apiRequest("PATCH", `/api/admin/shipping-options/${editingOption.id}`, body);
      } else {
        await apiRequest("POST", "/api/admin/shipping-options", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shipping-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-options"] });
      toast({ title: editingOption ? "Shipping option updated" : "Shipping option added" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/shipping-options/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shipping-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping-options"] });
      toast({ title: "Shipping option deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      {canSee("features") && <FeatureToggles />}

      {canSee("payments") && <PaymentMethodSettings />}

      {canSee("affiliateBanner") && <AffiliateBannerSettings />}

      {canSee("freeShipping") && <FreeShippingSettings />}

      {canSee("emails") && <EmailSettings />}

      {canSee("shipping") && (
      <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Shipping Options</h2>
          <p className="text-sm text-muted-foreground">Manage shipping methods available at checkout</p>
        </div>
        <Button size="sm" onClick={startAdd} data-testid="button-add-shipping">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Option
        </Button>
      </div>

      {(addingOption || editingOption) && (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">
            {editingOption ? "Edit Shipping Option" : "New Shipping Option"}
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Standard Shipping"
                data-testid="input-shipping-name"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g. Pickup address or delivery details"
                rows={2}
                data-testid="input-shipping-description"
              />
            </div>
            <div>
              <Label className="text-xs">Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00 for free"
                data-testid="input-shipping-price"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formEnabled}
                onCheckedChange={setFormEnabled}
                data-testid="switch-shipping-enabled"
              />
              <Label className="text-xs">Enabled</Label>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!formName.trim() || saveMutation.isPending}
                data-testid="button-save-shipping"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm} data-testid="button-cancel-shipping">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : !shippingOptions?.length ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">No shipping options configured.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shippingOptions.map((option) => (
            <Card key={option.id} className="p-4" data-testid={`card-shipping-${option.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5">
                    {option.price > 0 ? (
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{option.name}</span>
                      <Badge variant={option.enabled ? "default" : "secondary"} className="text-[10px]">
                        {option.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{option.description}</p>
                    )}
                    <p className="text-sm font-medium mt-1">
                      {option.price === 0 ? "Free" : `$${option.price % 100 === 0 ? option.price / 100 : (option.price / 100).toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(option)}
                    data-testid={`button-edit-shipping-${option.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-delete-shipping-${option.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete shipping option?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove "{option.name}" from checkout.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(option.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </>
      )}
    </>
  );
}

function CustomersPanel() {
  const { data: customerList, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
  });
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = (customerList ?? []).filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const totalCustomers = customerList?.length ?? 0;
  const totalRevenue = (customerList ?? []).reduce((sum, c) => sum + (c.totalSpent || 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold" data-testid="stat-total-customers">{totalCustomers}</p>
          <p className="text-xs text-muted-foreground">Total Customers</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600" data-testid="stat-customer-revenue">${totalRevenue}</p>
          <p className="text-xs text-muted-foreground">Lifetime Revenue</p>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-customer-search"
          />
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {filtered.length} of {totalCustomers}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "No customers match your search." : "No customers yet. Customer profiles are created when orders are paid."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => {
            const addr = customer.shippingAddress as { name?: string; line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
            return (
              <Dialog key={customer.id}>
                <DialogTrigger asChild>
                  <button
                    className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    data-testid={`card-customer-${customer.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {(customer.name || customer.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm truncate" data-testid={`text-customer-name-${customer.id}`}>
                            {customer.name || customer.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{customer.email}</span>
                          <span>{customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold shrink-0" data-testid={`text-customer-spent-${customer.id}`}>
                        ${customer.totalSpent}
                      </span>
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-base">Customer Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(customer.name || customer.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{customer.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <p className="text-lg font-bold">{customer.orderCount}</p>
                        <p className="text-[10px] text-muted-foreground">{customer.orderCount === 1 ? "Order" : "Orders"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <p className="text-lg font-bold text-green-600">${customer.totalSpent}</p>
                        <p className="text-[10px] text-muted-foreground">Lifetime Spent</p>
                      </div>
                    </div>

                    {customer.phone && (
                      <div className="border-t pt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{customer.phone}</span>
                        </div>
                      </div>
                    )}

                    {addr && addr.line1 && (
                      <div className="border-t pt-3">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Address
                        </p>
                        <div className="text-sm space-y-0.5">
                          <p className="text-muted-foreground">{addr.line1}</p>
                          {addr.line2 && <p className="text-muted-foreground">{addr.line2}</p>}
                          <p className="text-muted-foreground">{addr.city}, {addr.state} {addr.zip}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      )}
    </>
  );
}

interface AffiliateWithStats extends Affiliate {
  stats: { totalClicks: number; totalSales: number; totalRevenue: number; unpaidEarnings: number; paidEarnings: number };
}

function AffiliatesPanel() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", code: "", commissionRate: 10, referralDiscount: 10, approved: true });
  const [editForm, setEditForm] = useState({ name: "", email: "", code: "", commissionRate: 10, referralDiscount: 10 });

  const { data: affiliates, isLoading } = useQuery<AffiliateWithStats[]>({ queryKey: ["/api/admin/affiliates"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/affiliates", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      setAddOpen(false);
      setForm({ name: "", email: "", code: "", commissionRate: 10, referralDiscount: 10, approved: true });
      toast({ title: "Affiliate created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/admin/affiliates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      setEditId(null);
      toast({ title: "Affiliate updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/affiliates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      toast({ title: "Affiliate deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/affiliates/${id}/pay`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      toast({ title: `Marked ${data.count} referral(s) as paid` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unpayMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/affiliates/${id}/unpay`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates"] });
      toast({ title: `Reverted ${data.count} referral(s) back to unpaid` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-center py-10 text-muted-foreground">Loading...</div>;

  const totalAffiliates = affiliates?.length || 0;
  const pendingApproval = affiliates?.filter(a => !a.approved).length || 0;
  const totalUnpaid = affiliates?.reduce((s, a) => s + a.stats.unpaidEarnings, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{totalAffiliates}</p>
          <p className="text-xs text-muted-foreground">Total Affiliates</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingApproval}</p>
          <p className="text-xs text-muted-foreground">Pending Approval</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">${totalUnpaid}</p>
          <p className="text-xs text-muted-foreground">Unpaid Commissions</p>
        </Card>
      </div>

      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full" data-testid="button-add-affiliate"><Plus className="h-4 w-4 mr-1" />Add Affiliate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Affiliate</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-admin-aff-name" /></div>
              <div><Label>Email *</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-admin-aff-email" /></div>
              <div><Label>Referral Code *</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) }))} className="uppercase" data-testid="input-admin-aff-code" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Commission %</Label><Input type="number" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: parseInt(e.target.value) || 0 }))} data-testid="input-admin-aff-commission" /></div>
                <div><Label>Customer Discount %</Label><Input type="number" value={form.referralDiscount} onChange={e => setForm(f => ({ ...f, referralDiscount: parseInt(e.target.value) || 0 }))} data-testid="input-admin-aff-discount" /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.approved} onCheckedChange={v => setForm(f => ({ ...f, approved: v }))} />
                <Label>Pre-approved</Label>
              </div>
              <Button className="w-full rounded-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name || !form.email || !form.code} data-testid="button-create-affiliate">
                {createMutation.isPending ? <Loader className="h-4 w-4 animate-spin mr-1" /> : null}Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Affiliate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-aff-name" /></div>
            <div><Label>Email *</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} data-testid="input-edit-aff-email" /></div>
            <div><Label>Referral Code *</Label><Input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) }))} className="uppercase" data-testid="input-edit-aff-code" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commission %</Label>
                <Input type="number" min={0} max={100} value={editForm.commissionRate} onChange={e => setEditForm(f => ({ ...f, commissionRate: parseInt(e.target.value) || 0 }))} data-testid="input-edit-aff-commission" />
              </div>
              <div>
                <Label>Customer Discount %</Label>
                <Input type="number" min={0} max={100} value={editForm.referralDiscount} onChange={e => setEditForm(f => ({ ...f, referralDiscount: parseInt(e.target.value) || 0 }))} data-testid="input-edit-aff-discount" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Note: discount changes only apply to future referrals — existing Stripe coupons are not modified.</p>
            <Button className="w-full rounded-full" onClick={() => {
              if (!editId) return;
              updateMutation.mutate({ id: editId, data: editForm });
              setEditOpen(false);
            }} disabled={updateMutation.isPending || !editForm.name || !editForm.email || !editForm.code} data-testid="button-save-affiliate">
              {updateMutation.isPending ? <Loader className="h-4 w-4 animate-spin mr-1" /> : null}Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {affiliates?.map(aff => (
          <Card key={aff.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold truncate">{aff.name}</span>
                  {!aff.approved && <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                  {!aff.active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                  {aff.approved && aff.active && <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{aff.email}</p>
                <p className="text-xs font-mono mt-1">Code: {aff.code.toUpperCase()} | {aff.commissionRate}% comm. | {aff.referralDiscount}% disc.</p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{aff.stats.totalClicks} clicks</span>
                  <span>{aff.stats.totalSales} sales</span>
                  <span>${aff.stats.totalRevenue} rev.</span>
                  <span className="text-green-600 font-medium">${aff.stats.unpaidEarnings} unpaid</span>
                  <span>${aff.stats.paidEarnings} paid</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!aff.approved && (
                  <Button size="sm" variant="outline" className="text-xs rounded-full" onClick={() => updateMutation.mutate({ id: aff.id, data: { approved: true } })} data-testid={`button-approve-${aff.id}`}>
                    <Check className="h-3 w-3 mr-1" />Approve
                  </Button>
                )}
                {aff.stats.unpaidEarnings > 0 && (
                  <Button size="sm" variant="outline" className="text-xs rounded-full" onClick={() => payMutation.mutate(aff.id)} data-testid={`button-pay-${aff.id}`}>
                    <DollarSign className="h-3 w-3 mr-1" />Pay
                  </Button>
                )}
                {aff.stats.paidEarnings > 0 && (
                  <Button size="sm" variant="outline" className="text-xs rounded-full text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => unpayMutation.mutate(aff.id)} data-testid={`button-unpay-${aff.id}`}>
                    <RotateCcw className="h-3 w-3 mr-1" />Revert Paid
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs rounded-full" onClick={() => {
                  setEditId(aff.id);
                  setEditForm({ name: aff.name, email: aff.email, code: aff.code, commissionRate: aff.commissionRate, referralDiscount: aff.referralDiscount });
                  setEditOpen(true);
                }} data-testid={`button-edit-aff-${aff.id}`}>
                  <Pencil className="h-3 w-3 mr-1" />Edit
                </Button>
                <Button size="sm" variant="outline" className="text-xs rounded-full" onClick={() => {
                  updateMutation.mutate({ id: aff.id, data: { active: !aff.active } });
                }} data-testid={`button-toggle-${aff.id}`}>
                  {aff.active ? "Deactivate" : "Activate"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-delete-aff-${aff.id}`}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Affiliate</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently remove {aff.name} and all their referral data.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(aff.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
        {affiliates?.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No affiliates yet. Add your first affiliate to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminUserForm({
  initial,
  onSuccess,
  onCancel,
  isCurrentUser,
  onlySuperAdmin,
}: {
  initial?: AdminUserRecord;
  onSuccess: () => void;
  onCancel: () => void;
  isCurrentUser: boolean;
  onlySuperAdmin: boolean;
}) {
  const { toast } = useToast();
  const isEdit = !!initial;
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(initial?.isSuperAdmin ?? false);
  const [tabs, setTabs] = useState<AdminTabKey[]>(initial?.permissions?.tabs ?? []);
  const [settingsSections, setSettingsSections] = useState<SettingsSectionKey[]>(
    initial?.permissions?.settingsSections ?? []
  );

  const toggleTab = (key: AdminTabKey) => {
    setTabs((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  };

  const toggleSettingsSection = (key: SettingsSectionKey) => {
    setSettingsSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const buildPermissions = () => {
    if (isSuperAdmin) return { tabs: [], settingsSections: [] as SettingsSectionKey[] };
    const perms: { tabs: AdminTabKey[]; settingsSections?: SettingsSectionKey[] } = { tabs };
    if (tabs.includes("settings")) {
      perms.settingsSections = settingsSections;
    } else {
      perms.settingsSections = [];
    }
    return perms;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const body: any = {};
        if (username && username !== initial!.username) body.username = username;
        if (password) body.password = password;
        if (!isCurrentUser) body.isSuperAdmin = isSuperAdmin;
        body.permissions = buildPermissions();
        return apiRequest("PATCH", `/api/admin/users/${initial!.id}`, body);
      } else {
        const body = {
          username,
          password,
          isSuperAdmin,
          permissions: buildPermissions(),
        };
        return apiRequest("POST", "/api/admin/users", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      toast({ title: isEdit ? "Admin updated" : "Admin created" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (isEdit && password && password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (!isSuperAdmin && tabs.length === 0) {
      toast({ title: "Pick at least one tab", description: "A limited admin needs access to at least one section.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-username">Username</Label>
        <Input
          id="admin-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. jane.doe"
          required
          autoComplete="off"
          data-testid="input-admin-username"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-password">
          Password {isEdit && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}
        </Label>
        <Input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEdit ? "•••••••• (unchanged)" : "min. 8 characters"}
          autoComplete="new-password"
          minLength={isEdit ? 0 : 8}
          data-testid="input-admin-password"
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Super admin
          </p>
          <p className="text-xs text-muted-foreground">
            Full access to everything, including managing other admins.
          </p>
          {isCurrentUser && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              You can't change your own super-admin status.
            </p>
          )}
          {onlySuperAdmin && initial?.isSuperAdmin && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Last super admin — can't be demoted.
            </p>
          )}
        </div>
        <Switch
          checked={isSuperAdmin}
          onCheckedChange={setIsSuperAdmin}
          disabled={isCurrentUser || (onlySuperAdmin && initial?.isSuperAdmin)}
          data-testid="switch-super-admin"
        />
      </div>

      {!isSuperAdmin && (
        <div className="space-y-2">
          <Label>Allowed admin sections</Label>
          <p className="text-xs text-muted-foreground">
            Pick which tabs this admin can see and manage.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ASSIGNABLE_TABS.map((key) => {
              const def = TAB_DEFINITIONS.find((d) => d.key === key)!;
              const checked = tabs.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleTab(key)}
                  className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                  data-testid={`toggle-tab-${key}`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{def.label}</p>
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isSuperAdmin && tabs.includes("settings") && (
        <div className="space-y-2 rounded-md border border-dashed p-3 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings sub-sections
            </Label>
            {settingsSections.length === 0 && (
              <span className="text-[10px] uppercase tracking-wider rounded-sm bg-primary/10 text-primary px-1.5 py-0.5">
                All access
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Pick exactly which parts of Settings this admin can edit. Leave all unchecked to grant access to every section.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {SETTINGS_SECTION_DEFINITIONS.map((s) => {
              const checked = settingsSections.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSettingsSection(s.key)}
                  className={`flex items-start gap-3 rounded-md border p-2.5 text-left transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                  data-testid={`toggle-settings-section-${s.key}`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {checked && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{s.label}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{s.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} data-testid="button-cancel-admin-form">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending} data-testid="button-save-admin-form">
          {mutation.isPending ? <Loader className="h-4 w-4 animate-spin" /> : isEdit ? "Save Changes" : "Create Admin"}
        </Button>
      </div>
    </form>
  );
}

function AdminUsersPanel({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRecord | null>(null);

  const { data: users, isLoading } = useQuery<AdminUserRecord[]>({
    queryKey: ["/api/admin/users"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Admin deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const superCount = (users ?? []).filter((u) => u.isSuperAdmin).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Admin Users & Roles
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create admin accounts and choose which sections each one can access.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-admin">
              <Plus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Admin User</DialogTitle>
            </DialogHeader>
            <AdminUserForm
              isCurrentUser={false}
              onlySuperAdmin={false}
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (users ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No admin users yet.</Card>
      ) : (
        <div className="space-y-3">
          {(users ?? []).map((u) => {
            const isSelf = u.id === currentUserId;
            const isLastSuper = u.isSuperAdmin && superCount <= 1;
            const allowedTabs = u.permissions?.tabs ?? [];
            return (
              <Card key={u.id} className="p-4" data-testid={`card-admin-${u.id}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" data-testid={`text-admin-username-${u.id}`}>{u.username}</p>
                      {u.isSuperAdmin ? (
                        <Badge className="gap-1" data-testid={`badge-super-${u.id}`}>
                          <ShieldCheck className="h-3 w-3" />
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldOff className="h-3 w-3" />
                          Limited
                        </Badge>
                      )}
                      {isSelf && <Badge variant="outline">You</Badge>}
                    </div>
                    {!u.isSuperAdmin && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {allowedTabs.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No sections assigned</span>
                        ) : (
                          allowedTabs.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">
                              {tabLabel(t)}
                            </Badge>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(u)}
                      data-testid={`button-edit-admin-${u.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={isSelf || isLastSuper}
                          data-testid={`button-delete-admin-${u.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete admin user?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove <span className="font-medium">{u.username}</span>'s access to the admin panel. This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-admin-${u.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Admin User</DialogTitle>
          </DialogHeader>
          {editing && (
            <AdminUserForm
              initial={editing}
              isCurrentUser={editing.id === currentUserId}
              onlySuperAdmin={superCount <= 1}
              onSuccess={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const flags = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<AdminTabKey>("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: session, isLoading: sessionLoading } = useQuery<{ user: AdminSessionUser } | null>({
    queryKey: ["/api/admin/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/logout");
    clearAdminToken();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
    navigate("/");
  };

  useEffect(() => {
    document.title = "Admin Panel - Aura Peptides";
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.user) {
      navigate("/admin/login");
    }
  }, [sessionLoading, session, navigate]);

  if (sessionLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const visibleTabs = getVisibleTabs(session.user, flags);
  const visibleTabKeys = visibleTabs.map((t) => t.key);
  const effectiveTab: AdminTabKey | null = visibleTabKeys.includes(activeTab)
    ? activeTab
    : (visibleTabKeys[0] ?? null);

  if (visibleTabs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">No Access</h1>
        <p className="text-muted-foreground mb-6">
          Your admin account doesn't have access to any sections yet. Ask a super admin to grant you permissions.
        </p>
        <Button onClick={handleLogout} data-testid="button-logout-no-access">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    );
  }

  const filteredProducts = (products ?? []).filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalProducts = products?.length ?? 0;
  const inStockCount = products?.filter((p) => p.inStock).length ?? 0;
  const featuredCount = products?.filter((p) => p.featured).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Logged in as <span className="font-medium text-foreground">{session.user.username}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {effectiveTab === "products" && visibleTabKeys.includes("products") && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-product">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                </DialogHeader>
                <ProductForm onSuccess={() => setAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b overflow-x-auto">
        {visibleTabs.map((t) => {
          const Icon = TAB_ICONS[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                effectiveTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              data-testid={`tab-${t.key}`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {effectiveTab === "users" && session.user.isSuperAdmin ? (
        <AdminUsersPanel currentUserId={session.user.id} />
      ) : effectiveTab === "orders" && visibleTabKeys.includes("orders") ? (
        <OrdersPanel />
      ) : effectiveTab === "customers" && visibleTabKeys.includes("customers") ? (
        <CustomersPanel />
      ) : effectiveTab === "certificates" && visibleTabKeys.includes("certificates") ? (
        <CertificatesPanel />
      ) : effectiveTab === "emails" && visibleTabKeys.includes("emails") ? (
        <EmailsPanel />
      ) : effectiveTab === "affiliates" && visibleTabKeys.includes("affiliates") ? (
        <AffiliatesPanel />
      ) : effectiveTab === "settings" && visibleTabKeys.includes("settings") ? (
        <SettingsPanel />
      ) : effectiveTab === "products" && visibleTabKeys.includes("products") ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold" data-testid="stat-total">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">Total Products</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600" data-testid="stat-in-stock">{inStockCount}</p>
              <p className="text-xs text-muted-foreground">In Stock</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-primary" data-testid="stat-featured">{featuredCount}</p>
              <p className="text-xs text-muted-foreground">Featured</p>
            </Card>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or slug..."
                className="pl-9"
                data-testid="input-admin-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-clear-search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="peptide">Peptide</SelectItem>
                <SelectItem value="blend">Blend</SelectItem>
                <SelectItem value="stack">Stack</SelectItem>
                <SelectItem value="accessory">Accessory</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery || categoryFilter !== "all"
                  ? "No products match your filters."
                  : "No products yet. Add your first product."}
              </p>
              {(searchQuery || categoryFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }}
                  data-testid="button-clear-filters"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                Showing {filteredProducts.length} of {totalProducts} products
              </p>
              {filteredProducts.map((product) => (
                <Card key={product.id} className="p-4" data-testid={`card-admin-product-${product.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-muted/30 shrink-0">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" data-testid={`text-admin-product-name-${product.id}`}>
                          {product.name}
                        </h3>
                        <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                        {product.featured && <Badge className="text-[10px]">Featured</Badge>}
                        {!product.inStock && <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {product.contents} &middot; ${(product.price / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Dialog
                        open={editDialogOpen && editingProduct?.id === product.id}
                        onOpenChange={(open) => {
                          setEditDialogOpen(open);
                          if (!open) setEditingProduct(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingProduct(product);
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-${product.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Edit Product</DialogTitle>
                          </DialogHeader>
                          {editingProduct && (
                            <ProductForm
                              product={editingProduct}
                              onSuccess={() => {
                                setEditDialogOpen(false);
                                setEditingProduct(null);
                              }}
                            />
                          )}
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-${product.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently remove the product from your catalog.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(product.id)} data-testid={`button-confirm-delete-${product.id}`}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
