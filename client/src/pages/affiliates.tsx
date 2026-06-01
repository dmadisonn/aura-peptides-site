import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, DollarSign, MousePointerClick, ShoppingCart, TrendingUp, LogOut, Loader2, Link2, Users, BarChart3, Wallet, ArrowRight, CheckCircle2, X } from "lucide-react";

const AFF_SESSION_KEY = "aura-affiliate-session";

function getAffSession(): string | null {
  return localStorage.getItem(AFF_SESSION_KEY);
}

function setAffSession(token: string) {
  localStorage.setItem(AFF_SESSION_KEY, token);
}

function clearAffSession() {
  localStorage.removeItem(AFF_SESSION_KEY);
}

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  code: string;
  commissionRate: number;
  referralDiscount: number;
  payoutMethod: string | null;
  paypalEmail: string | null;
  venmoHandle: string | null;
  cashappHandle: string | null;
  zelleContact: string | null;
  stats: {
    totalClicks: number;
    totalSales: number;
    conversionRate: number;
    pendingPayout: number;
    totalEarned: number;
  };
}

interface Referral {
  id: string;
  orderId: string | null;
  orderTotal: number | null;
  commissionAmount: number | null;
  status: string;
  convertedAt: string | null;
}

function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutHandle, setPayoutHandle] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/affiliate/signup", {
        name, email, phone, code, payoutMethod, payoutHandle,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Application submitted!", description: data.message });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="aff-name">Full Name *</Label>
        <Input id="aff-name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" data-testid="input-affiliate-name" />
      </div>
      <div>
        <Label htmlFor="aff-email">Email *</Label>
        <Input id="aff-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-affiliate-email" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="aff-phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input id="aff-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" data-testid="input-affiliate-phone" />
        </div>
        <div>
          <Label htmlFor="aff-code">Referral Code *</Label>
          <Input id="aff-code" value={code} onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10))} placeholder="MYCODE" className="uppercase" data-testid="input-affiliate-code" />
          <p className="text-[11px] text-muted-foreground mt-1">1–10 alphanumeric characters</p>
        </div>
      </div>
      <div>
        <Label>Payout Method <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Select value={payoutMethod} onValueChange={setPayoutMethod}>
          <SelectTrigger data-testid="select-payout-method"><SelectValue placeholder="Select method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paypal">PayPal</SelectItem>
            <SelectItem value="venmo">Venmo</SelectItem>
            <SelectItem value="cashapp">Cash App</SelectItem>
            <SelectItem value="zelle">Zelle</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {payoutMethod && (
        <div>
          <Label htmlFor="aff-payout-handle">
            {payoutMethod === "paypal" ? "PayPal Email" : payoutMethod === "venmo" ? "Venmo Handle" : payoutMethod === "cashapp" ? "Cash App Tag" : "Zelle Phone/Email"}
          </Label>
          <Input id="aff-payout-handle" value={payoutHandle} onChange={e => setPayoutHandle(e.target.value)} data-testid="input-payout-handle" />
        </div>
      )}
      <Button
        className="w-full rounded-full h-11 text-sm font-semibold"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !name || !email || !code}
        data-testid="button-submit-affiliate"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Submit Application
      </Button>
      <p className="text-xs text-center text-muted-foreground">We review applications within 1–2 business days.</p>
    </div>
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/affiliate/request-magic-link", { email });
      return res.json();
    },
    onSuccess: () => {
      setSent(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (sent) {
    return (
      <div className="text-center py-6">
        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">If an affiliate account exists for that email, we've sent a sign-in link. It expires in 15 minutes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter your affiliate email and we'll send you a secure, passwordless sign-in link.</p>
      <div>
        <Label htmlFor="login-email">Email Address</Label>
        <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-login-email" />
      </div>
      <Button
        className="w-full rounded-full h-11 text-sm font-semibold"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !email}
        data-testid="button-send-magic-link"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Send Sign-In Link
      </Button>
    </div>
  );
}

function Dashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const token = getAffSession();

  const { data: affiliate, isLoading } = useQuery<AffiliateData>({
    queryKey: ["/api/affiliate/me"],
    queryFn: async () => {
      const res = await fetch("/api/affiliate/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  const { data: referrals } = useQuery<Referral[]>({
    queryKey: ["/api/affiliate/me/referrals"],
    queryFn: async () => {
      const res = await fetch("/api/affiliate/me/referrals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!affiliate,
  });

  const [editCode, setEditCode] = useState("");
  const [editPayout, setEditPayout] = useState("");
  const [editPayoutHandle, setEditPayoutHandle] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (affiliate) {
      setEditCode(affiliate.code);
      setEditPayout(affiliate.payoutMethod || "");
      setEditPayoutHandle(
        affiliate.paypalEmail || affiliate.venmoHandle || affiliate.cashappHandle || affiliate.zelleContact || ""
      );
    }
  }, [affiliate]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/affiliate/me", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: editCode, payoutMethod: editPayout, payoutHandle: editPayoutHandle }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/me"] });
      setEditing(false);
      toast({ title: "Settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!affiliate) {
    clearAffSession();
    return null;
  }

  const siteUrl = window.location.origin;
  const referralLink = `${siteUrl}/?ref=${affiliate.code}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  const handleLogout = () => {
    clearAffSession();
    navigate("/affiliates");
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-affiliate-name">{affiliate.name}</h2>
          <p className="text-muted-foreground text-sm">{affiliate.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-affiliate-logout">
          <LogOut className="h-4 w-4 mr-1" /> Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <MousePointerClick className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="stat-clicks">{affiliate.stats.totalClicks}</p>
          <p className="text-xs text-muted-foreground">Total Clicks</p>
        </Card>
        <Card className="p-4 text-center">
          <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="stat-sales">{affiliate.stats.totalSales}</p>
          <p className="text-xs text-muted-foreground">Conversions</p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="stat-rate">{affiliate.stats.conversionRate}%</p>
          <p className="text-xs text-muted-foreground">Conv. Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="stat-earned">${affiliate.stats.totalEarned}</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </Card>
      </div>

      {affiliate.stats.pendingPayout > 0 && (
        <Card className="p-4 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Pending Payout: <span className="text-lg font-bold">${affiliate.stats.pendingPayout}</span>
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Your Referral Link</h3>
          <Badge>{affiliate.commissionRate}% commission</Badge>
        </div>
        <div className="flex gap-2">
          <Input value={referralLink} readOnly className="text-sm font-mono" data-testid="input-referral-link" />
          <Button variant="outline" size="icon" onClick={handleCopyLink} data-testid="button-copy-link">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Customers who use your link get {affiliate.referralDiscount}% off their order.
          You earn {affiliate.commissionRate}% commission on each sale.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Settings</h3>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-settings">
              Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label>Referral Code</Label>
              <Input value={editCode} onChange={e => setEditCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10))} className="uppercase" data-testid="input-edit-code" />
            </div>
            <div>
              <Label>Payout Method</Label>
              <Select value={editPayout} onValueChange={setEditPayout}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="cashapp">Cash App</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editPayout && (
              <div>
                <Label>{editPayout === "paypal" ? "PayPal Email" : editPayout === "venmo" ? "Venmo Handle" : editPayout === "cashapp" ? "Cash App Handle" : "Zelle Contact"}</Label>
                <Input value={editPayoutHandle} onChange={e => setEditPayoutHandle(e.target.value)} data-testid="input-edit-payout" />
              </div>
            )}
            <div className="flex gap-2">
              <Button className="rounded-full" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-settings">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save
              </Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm space-y-1.5 text-muted-foreground">
            <p><span className="text-foreground font-medium">Code:</span> {affiliate.code.toUpperCase()}</p>
            <p><span className="text-foreground font-medium">Payout:</span> {affiliate.payoutMethod ? `${affiliate.payoutMethod.charAt(0).toUpperCase() + affiliate.payoutMethod.slice(1)}` : "Not set"}</p>
          </div>
        )}
      </Card>

      {referrals && referrals.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Conversion History</h3>
          <div className="divide-y">
            {referrals.map(ref => (
              <div key={ref.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Order #{ref.orderId?.slice(-6) || "---"}</p>
                  <p className="text-xs text-muted-foreground">
                    {ref.convertedAt ? new Date(ref.convertedAt).toLocaleDateString() : "---"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${ref.commissionAmount || 0}</p>
                  <Badge variant={ref.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                    {ref.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const STEPS = [
  {
    num: "01",
    icon: Users,
    title: "Apply in 60 Seconds",
    desc: "Fill out a quick form with your name, email, and preferred referral code. No fees, no commitments.",
  },
  {
    num: "02",
    icon: Link2,
    title: "Share Your Link",
    desc: "Once approved, you'll get a unique referral link and discount code to share with your audience.",
  },
  {
    num: "03",
    icon: BarChart3,
    title: "Track Performance",
    desc: "Monitor clicks, conversions, and earnings in real time from your personal affiliate dashboard.",
  },
  {
    num: "04",
    icon: Wallet,
    title: "Get Paid",
    desc: "Earn commission on every sale. Choose PayPal, Venmo, Cash App, or Zelle for payouts.",
  },
];

const BENEFITS = [
  "Generous commission on every referred sale",
  "Your customers get an exclusive discount",
  "Real-time dashboard with click and conversion analytics",
  "30-day cookie window for attributed sales",
  "Passwordless sign-in — no passwords to remember",
  "Flexible payout options: PayPal, Venmo, Cash App, Zelle",
];

export default function AffiliatesPage() {
  const [signupOpen, setSignupOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<"landing" | "dashboard">("landing");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magic");

    if (magicToken) {
      fetch(`/api/affiliate/verify-magic-link?token=${magicToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.affiliateSessionToken) {
            setAffSession(data.affiliateSessionToken);
            setMode("dashboard");
            const url = new URL(window.location.href);
            url.searchParams.delete("magic");
            window.history.replaceState({}, "", url.pathname);
          } else {
            toast({ title: "Invalid or expired link", description: "Please request a new sign-in link.", variant: "destructive" });
          }
        })
        .catch(() => {
          toast({ title: "Error verifying link", variant: "destructive" });
        });
      return;
    }

    if (getAffSession()) {
      setMode("dashboard");
    }
  }, []);

  if (mode === "dashboard") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        <Dashboard />
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
          <svg viewBox="0 0 800 800" className="w-[1000px] h-[1000px] opacity-[0.18]" fill="none">
            <circle cx="400" cy="400" r="370" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="400" cy="400" r="280" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="400" cy="400" r="200" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="400" cy="400" r="130" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="400" cy="400" r="70" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-32 text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-background/65 mb-6">
            Affiliate Program
          </p>
          <h1
            className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.02] font-normal mb-6"
            data-testid="text-affiliate-title"
          >
            Share what you trust.
            <br />
            <span className="italic text-background/85">Earn on every order.</span>
          </h1>
          <p className="text-background/70 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Partner with Aura Peptides — your audience receives a thoughtful discount, and you
            earn a 10% commission on every conversion.
          </p>
          <div className="flex flex-col items-stretch sm:flex-row sm:items-center justify-center gap-3 px-2 sm:px-0">
            <Button
              size="lg"
              className="rounded-full h-12 px-8 text-sm font-semibold tracking-wide bg-background text-foreground hover:bg-background/90 w-full sm:w-auto sm:min-w-[200px]"
              onClick={() => setSignupOpen(true)}
              data-testid="button-apply"
            >
              Apply to Join
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full h-12 px-8 text-sm font-semibold tracking-wide border-background/30 text-background hover:bg-background/10 bg-transparent w-full sm:w-auto sm:min-w-[200px]"
              onClick={() => setLoginOpen(true)}
              data-testid="button-affiliate-login"
            >
              Sign In to Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">How It Works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm md:text-base">Four simple steps from signup to payout.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
            {STEPS.map((step, i) => (
              <div key={i} className="relative text-center group">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+32px)] w-[calc(100%-64px)] h-px bg-border" />
                )}
                <div className="relative z-10 h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 md:mb-4 group-hover:bg-primary/10 transition-colors">
                  <step.icon className="h-6 w-6 md:h-7 md:w-7 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1 block">{step.num}</span>
                <h3 className="font-semibold text-xs md:text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px] mx-auto hidden sm:block">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 md:py-24 bg-muted/40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Why Join?</h2>
              <p className="text-muted-foreground mb-8">
                Our affiliate program is designed to be simple, transparent, and rewarding.
                No minimums, no hoops — just share and earn.
              </p>
              <ul className="space-y-3">
                {BENEFITS.map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <Card className="p-5 border-2 border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Commission Per Sale</p>
                    <p className="text-xs text-muted-foreground">Earn on every referred order</p>
                  </div>
                </div>
                <p className="text-3xl font-bold">10%</p>
                <p className="text-xs text-muted-foreground mt-1">Default rate — custom rates available</p>
              </Card>
              <Card className="p-5 border-2 border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Customer Discount</p>
                    <p className="text-xs text-muted-foreground">Your audience saves on their order</p>
                  </div>
                </div>
                <p className="text-3xl font-bold">10%</p>
                <p className="text-xs text-muted-foreground mt-1">Exclusive discount via your link or code</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-20 bg-background">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Ready to Start Earning?</h2>
          <p className="text-muted-foreground mb-8 text-sm md:text-base">Join our affiliate program today. Applications are reviewed within 1–2 business days.</p>
          <div className="flex flex-col items-stretch sm:flex-row sm:items-center justify-center gap-3 px-2 sm:px-0">
            <Button
              size="lg"
              className="rounded-full h-12 px-8 text-sm font-semibold w-full sm:w-auto sm:min-w-[200px]"
              onClick={() => setSignupOpen(true)}
              data-testid="button-apply-bottom"
            >
              Apply Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full h-12 px-8 text-sm font-semibold w-full sm:w-auto sm:min-w-[200px]"
              onClick={() => setLoginOpen(true)}
              data-testid="button-login-bottom"
            >
              Existing Affiliate? Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Signup Dialog */}
      <Dialog open={signupOpen} onOpenChange={(open) => { setSignupOpen(open); if (!open) setSubmitted(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{submitted ? "Application Received" : "Apply to the Affiliate Program"}</DialogTitle>
          </DialogHeader>
          {submitted ? (
            <div className="text-center py-6">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-4">
                We'll review your application within 1–2 business days. You'll receive an email with your dashboard access once approved.
              </p>
              <Button variant="outline" className="rounded-full" onClick={() => { setSignupOpen(false); setSubmitted(false); }}>
                Close
              </Button>
            </div>
          ) : (
            <SignupForm onSuccess={() => setSubmitted(true)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Affiliate Sign In</DialogTitle>
          </DialogHeader>
          <LoginForm onLogin={() => { setLoginOpen(false); setMode("dashboard"); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
