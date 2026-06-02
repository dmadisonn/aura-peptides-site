import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import pg from "pg";
import pgSession from "connect-pg-simple";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import {
  users, products, orders, certificates, shippingOptions,
  customers, siteSettings, emailLogs, newsletterSubscribers,
  affiliates, affiliateReferrals,
} from "../shared/schema";

const app = express();
const PgSession = pgSession(session);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "aura-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

function hashPw(p: string) {
  return crypto.createHash("sha256").update(p).digest("hex");
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any)?.adminUser)
    return res.status(401).json({ message: "Unauthorized" });
  next();
}

function requireSuper(req: Request, res: Response, next: NextFunction) {
  const u = (req.session as any)?.adminUser;
  if (!u) return res.status(401).json({ message: "Unauthorized" });
  if (!u.isSuperAdmin) return res.status(403).json({ message: "Forbidden" });
  next();
}

// ── Public ────────────────────────────────────────────────────────────────────

app.get("/api/products", async (_req, res) => {
  try {
    const rows = await db.select().from(products).where(eq(products.published, true)).orderBy(products.name);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.get("/api/products/:slug", async (req, res) => {
  try {
    const [p] = await db.select().from(products).where(eq(products.slug, req.params.slug));
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.get("/api/feature-flags", async (_req, res) => {
  try {
    const [s] = await db.select().from(siteSettings);
    const flags = (s?.featureFlags as any) || {};
    res.json({ emails: flags.emails ?? false, affiliates: flags.affiliates ?? true, aiImage: false });
  } catch { res.json({ emails: false, affiliates: true, aiImage: false }); }
});

app.get("/api/settings/affiliate-banner", async (_req, res) => {
  try {
    const [s] = await db.select().from(siteSettings);
    res.json({ enabled: s?.affiliateBannerEnabled ?? true });
  } catch { res.json({ enabled: true }); }
});

app.get("/api/settings/free-shipping-threshold", async (_req, res) => {
  try {
    const [s] = await db.select().from(siteSettings);
    res.json({ threshold: s?.freeShippingThreshold ?? 10000 });
  } catch { res.json({ threshold: 10000 }); }
});

app.get("/api/settings/payment-methods", (_req, res) => {
  res.json({ stripe: false, invoice: true });
});

app.get("/api/shipping-options", async (_req, res) => {
  try {
    const rows = await db.select().from(shippingOptions).where(eq(shippingOptions.isActive, true));
    res.json(rows);
  } catch { res.json([]); }
});

app.get("/api/certificates", async (_req, res) => {
  try {
    const rows = await db.select().from(certificates);
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/newsletter/subscribe", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    await db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email,
      name: name || null,
      isActive: true,
      createdAt: new Date(),
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Missing credentials" });
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user || user.password !== hashPw(password))
      return res.status(401).json({ message: "Invalid credentials" });
    (req.session as any).adminUser = {
      id: user.id,
      username: user.username,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions ?? {
        tabs: ["products","orders","customers","certificates","emails","affiliates","settings"],
      },
    };
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/api/admin/session", (req, res) => {
  const u = (req.session as any)?.adminUser;
  if (!u) return res.status(401).json(null);
  res.json({ user: u });
});

// ── Admin: Products ───────────────────────────────────────────────────────────

app.get("/api/admin/products", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const [p] = await db.insert(products).values({
      ...req.body,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    res.json(p);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const [p] = await db.update(products)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(products.id, req.params.id))
      .returning();
    res.json(p);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(products).where(eq(products.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Orders ─────────────────────────────────────────────────────────────

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/orders", requireAdmin, async (req, res) => {
  try {
    const orderNumber = `ORD-${Date.now()}`;
    const [o] = await db.insert(orders).values({
      ...req.body,
      id: crypto.randomUUID(),
      orderNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    res.json(o);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const [o] = await db.update(orders)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(orders.id, req.params.id))
      .returning();
    res.json(o);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/orders/:id/mark-paid", requireAdmin, async (req, res) => {
  try {
    await db.update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Customers & Newsletter ─────────────────────────────────────────────

app.get("/api/admin/customers", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(customers).orderBy(desc(customers.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.get("/api/admin/newsletter", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/newsletter/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Affiliates ─────────────────────────────────────────────────────────

app.get("/api/admin/affiliates", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/affiliates", requireAdmin, async (req, res) => {
  try {
    const code = req.body.code || (req.body.name?.toLowerCase().replace(/\s+/g, "-").slice(0, 12) + "-" + Date.now().toString(36));
    const [a] = await db.insert(affiliates).values({
      ...req.body,
      id: crypto.randomUUID(),
      code,
      isActive: true,
      totalEarned: 0,
      totalPaid: 0,
      createdAt: new Date(),
    }).returning();
    res.json(a);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/affiliates/:id", requireAdmin, async (req, res) => {
  try {
    const [a] = await db.update(affiliates)
      .set(req.body)
      .where(eq(affiliates.id, req.params.id))
      .returning();
    res.json(a);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Certificates ───────────────────────────────────────────────────────

app.get("/api/admin/certificates", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(certificates).orderBy(desc(certificates.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/certificates", requireAdmin, async (req, res) => {
  try {
    const [c] = await db.insert(certificates).values({
      ...req.body,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }).returning();
    res.json(c);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/certificates/:id", requireAdmin, async (req, res) => {
  try {
    const [c] = await db.update(certificates)
      .set(req.body)
      .where(eq(certificates.id, req.params.id))
      .returning();
    res.json(c);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/certificates/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(certificates).where(eq(certificates.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Shipping & Settings ────────────────────────────────────────────────

app.get("/api/admin/shipping-options", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(shippingOptions).orderBy(shippingOptions.name);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/shipping-options", requireAdmin, async (req, res) => {
  try {
    const [opt] = await db.insert(shippingOptions).values({
      ...req.body,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }).returning();
    res.json(opt);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/shipping-options/:id", requireAdmin, async (req, res) => {
  try {
    const [opt] = await db.update(shippingOptions)
      .set(req.body)
      .where(eq(shippingOptions.id, req.params.id))
      .returning();
    res.json(opt);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/shipping-options/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(shippingOptions).where(eq(shippingOptions.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/settings/free-shipping-threshold", requireAdmin, async (req, res) => {
  try {
    await db.update(siteSettings).set({ freeShippingThreshold: req.body.threshold, updatedAt: new Date() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/feature-flags", requireAdmin, async (req, res) => {
  try {
    await db.update(siteSettings).set({ featureFlags: req.body, updatedAt: new Date() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/settings/affiliate-banner", requireAdmin, async (req, res) => {
  try {
    await db.update(siteSettings).set({ affiliateBannerEnabled: req.body.enabled, updatedAt: new Date() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/settings/payment-methods", requireAdmin, (_req, res) => {
  res.json({ success: true });
});

// ── Admin: Users ──────────────────────────────────────────────────────────────

app.get("/api/admin/users", requireSuper, async (_req, res) => {
  try {
    const rows = await db.select().from(users).where(eq(users.isAdmin, true));
    res.json(rows.map((u) => ({ ...u, password: undefined })));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/users", requireSuper, async (req, res) => {
  try {
    const [u] = await db.insert(users).values({
      id: crypto.randomUUID(),
      username: req.body.username,
      password: hashPw(req.body.password),
      isAdmin: true,
      isSuperAdmin: req.body.isSuperAdmin ?? false,
      permissions: req.body.permissions || {},
      createdAt: new Date(),
    }).returning();
    res.json({ ...u, password: undefined });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/users/:id", requireSuper, async (req, res) => {
  try {
    const update: any = { ...req.body };
    if (update.password) update.password = hashPw(update.password);
    const [u] = await db.update(users).set(update).where(eq(users.id, req.params.id)).returning();
    res.json({ ...u, password: undefined });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/users/:id", requireSuper, async (req, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Email logs ────────────────────────────────────────────────────────────────

app.get("/api/admin/email-logs", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(100);
    res.json(rows);
  } catch { res.json([]); }
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

export default app;
