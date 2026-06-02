const express = require("express");
const session = require("express-session");
const PgSessionStore = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new PgSessionStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "aura-secret-2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  },
}));

function hashPw(p) { return crypto.createHash("sha256").update(p).digest("hex"); }
function q(sql, params) { return pool.query(sql, params).then(r => r.rows); }
function requireAdmin(req, res, next) {
  if (!req.session?.adminUser) return res.status(401).json({ message: "Unauthorized" });
  next();
}
function requireSuper(req, res, next) {
  if (!req.session?.adminUser) return res.status(401).json({ message: "Unauthorized" });
  if (!req.session.adminUser.isSuperAdmin) return res.status(403).json({ message: "Forbidden" });
  next();
}

// ── Public ────────────────────────────────────────────────────────────────────

app.get("/api/products", async (_req, res) => {
  try { res.json(await q("SELECT * FROM products WHERE published = true ORDER BY name")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/products/:slug", async (req, res) => {
  try {
    const [p] = await q("SELECT * FROM products WHERE slug = $1", [req.params.slug]);
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/feature-flags", async (_req, res) => {
  try {
    const [s] = await q("SELECT feature_flags FROM site_settings LIMIT 1");
    const flags = s?.feature_flags || {};
    res.json({ emails: flags.emails ?? false, affiliates: flags.affiliates ?? true, aiImage: false });
  } catch { res.json({ emails: false, affiliates: true, aiImage: false }); }
});

app.get("/api/settings/affiliate-banner", async (_req, res) => {
  try {
    const [s] = await q("SELECT affiliate_banner_enabled FROM site_settings LIMIT 1");
    res.json({ enabled: s?.affiliate_banner_enabled ?? true });
  } catch { res.json({ enabled: true }); }
});

app.get("/api/settings/free-shipping-threshold", async (_req, res) => {
  try {
    const [s] = await q("SELECT free_shipping_threshold FROM site_settings LIMIT 1");
    res.json({ threshold: s?.free_shipping_threshold ?? 10000 });
  } catch { res.json({ threshold: 10000 }); }
});

app.get("/api/settings/payment-methods", (_req, res) => res.json({ stripe: false, invoice: true }));

app.get("/api/shipping-options", async (_req, res) => {
  try { res.json(await q("SELECT * FROM shipping_options WHERE is_active = true")); }
  catch { res.json([]); }
});

app.get("/api/certificates", async (_req, res) => {
  try { res.json(await q("SELECT * FROM certificates ORDER BY created_at DESC")); }
  catch { res.json([]); }
});

app.get("/api/config/google-maps-key", (_req, res) => res.json({ key: null }));

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Missing credentials" });
    const [user] = await q("SELECT * FROM users WHERE username = $1", [username]);
    if (!user || user.password !== hashPw(password))
      return res.status(401).json({ message: "Invalid credentials" });
    req.session.adminUser = {
      id: user.id, username: user.username,
      isSuperAdmin: user.is_super_admin,
      permissions: user.permissions ?? { tabs: ["products","orders","customers","certificates","affiliates","settings"] },
    };
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/logout", (req, res) => req.session.destroy(() => res.json({ success: true })));

app.get("/api/admin/session", (req, res) => {
  if (!req.session?.adminUser) return res.status(401).json(null);
  res.json({ user: req.session.adminUser });
});

// ── Admin: Products ───────────────────────────────────────────────────────────

app.get("/api/admin/products", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM products ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [p] = await q(
      `INSERT INTO products (id,name,slug,subtitle,description,price,compare_at_price,category,tags,image_url,in_stock,stock_quantity,sku,featured,published,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()) RETURNING *`,
      [crypto.randomUUID(), b.name, b.slug||b.name?.toLowerCase().replace(/\s+/g,'-'), b.subtitle||'', b.description||'',
       b.price||0, b.compareAtPrice||b.compare_at_price||0, b.category||'Peptides', JSON.stringify(b.tags||[]),
       b.imageUrl||b.image_url||'', b.inStock??b.in_stock??true, b.stockQuantity??b.stock_quantity??100,
       b.sku||'', b.featured??false, b.published??true]
    );
    res.json(p);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const fields = Object.keys(b).filter(k => !['id','created_at'].includes(k));
    const sets = fields.map((k,i) => `"${k.replace(/([A-Z])/g, '_$1').toLowerCase()}" = $${i+1}`).join(', ');
    const vals = fields.map(k => b[k]);
    vals.push(req.params.id);
    const [p] = await q(`UPDATE products SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    res.json(p);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try { await q("DELETE FROM products WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Orders ─────────────────────────────────────────────────────────────

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM orders ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/orders", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [o] = await q(
      `INSERT INTO orders (id,order_number,customer_email,customer_name,items,subtotal,shipping_cost,tax,total,status,shipping_address,shipping_option,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`,
      [crypto.randomUUID(), `ORD-${Date.now()}`, b.customer_email||b.customerEmail||'', b.customer_name||b.customerName||'',
       JSON.stringify(b.items||[]), b.subtotal||0, b.shipping_cost||b.shippingCost||0, b.tax||0, b.total||0,
       b.status||'pending', JSON.stringify(b.shipping_address||b.shippingAddress||{}), b.shipping_option||b.shippingOption||'']
    );
    res.json(o);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const { status, tracking_number, notes } = req.body;
    const [o] = await q(
      "UPDATE orders SET status=COALESCE($1,status), tracking_number=COALESCE($2,tracking_number), notes=COALESCE($3,notes), updated_at=NOW() WHERE id=$4 RETURNING *",
      [status, tracking_number, notes, req.params.id]
    );
    res.json(o);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/orders/:id/mark-paid", requireAdmin, async (req, res) => {
  try { await q("UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Customers ──────────────────────────────────────────────────────────

app.get("/api/admin/customers", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM customers ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/admin/newsletter", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM newsletter_subscribers ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/newsletter/:id", requireAdmin, async (req, res) => {
  try { await q("DELETE FROM newsletter_subscribers WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Affiliates ─────────────────────────────────────────────────────────

app.get("/api/admin/affiliates", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM affiliates ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/affiliates", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const code = b.code || (b.name?.toLowerCase().replace(/\s+/g,'-').slice(0,12) + '-' + Date.now().toString(36));
    const [a] = await q(
      "INSERT INTO affiliates (id,code,name,email,commission_rate,total_earned,total_paid,is_active,created_at) VALUES ($1,$2,$3,$4,$5,0,0,true,NOW()) RETURNING *",
      [crypto.randomUUID(), code, b.name||'', b.email||'', b.commissionRate||b.commission_rate||10]
    );
    res.json(a);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/affiliates/:id", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [a] = await q(
      "UPDATE affiliates SET name=COALESCE($1,name), email=COALESCE($2,email), commission_rate=COALESCE($3,commission_rate), is_active=COALESCE($4,is_active) WHERE id=$5 RETURNING *",
      [b.name, b.email, b.commissionRate||b.commission_rate, b.isActive??b.is_active, req.params.id]
    );
    res.json(a);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Certificates ───────────────────────────────────────────────────────

app.get("/api/admin/certificates", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM certificates ORDER BY created_at DESC")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/certificates", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [c] = await q(
      "INSERT INTO certificates (id,product_id,product_name,batch_number,purity,tested_by,test_date,file_url,file_type,title,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *",
      [crypto.randomUUID(), b.productId||b.product_id||null, b.productName||b.product_name||'', b.batchNumber||b.batch_number||'',
       b.purity||'', b.testedBy||b.tested_by||'', b.testDate||b.test_date||null, b.fileUrl||b.file_url||'',
       b.fileType||b.file_type||'pdf', b.title||'', b.notes||'']
    );
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/certificates/:id", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [c] = await q(
      "UPDATE certificates SET title=COALESCE($1,title), notes=COALESCE($2,notes), file_url=COALESCE($3,file_url) WHERE id=$4 RETURNING *",
      [b.title, b.notes, b.fileUrl||b.file_url, req.params.id]
    );
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/certificates/:id", requireAdmin, async (req, res) => {
  try { await q("DELETE FROM certificates WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Shipping & Settings ────────────────────────────────────────────────

app.get("/api/admin/shipping-options", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM shipping_options ORDER BY price")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/shipping-options", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [opt] = await q(
      "INSERT INTO shipping_options (id,name,price,estimated_days,is_active,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *",
      [crypto.randomUUID(), b.name||'', b.price||0, b.estimatedDays||b.estimated_days||5, b.isActive??b.is_active??true]
    );
    res.json(opt);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/shipping-options/:id", requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    const [opt] = await q(
      "UPDATE shipping_options SET name=COALESCE($1,name), price=COALESCE($2,price), estimated_days=COALESCE($3,estimated_days), is_active=COALESCE($4,is_active) WHERE id=$5 RETURNING *",
      [b.name, b.price, b.estimatedDays||b.estimated_days, b.isActive??b.is_active, req.params.id]
    );
    res.json(opt);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/shipping-options/:id", requireAdmin, async (req, res) => {
  try { await q("DELETE FROM shipping_options WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/settings/free-shipping-threshold", requireAdmin, async (req, res) => {
  try { await q("UPDATE site_settings SET free_shipping_threshold=$1, updated_at=NOW()", [req.body.threshold]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/feature-flags", requireAdmin, async (req, res) => {
  try { await q("UPDATE site_settings SET feature_flags=$1, updated_at=NOW()", [JSON.stringify(req.body)]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/settings/affiliate-banner", requireAdmin, async (req, res) => {
  try { await q("UPDATE site_settings SET affiliate_banner_enabled=$1, updated_at=NOW()", [req.body.enabled]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/settings/payment-methods", requireAdmin, (_req, res) => res.json({ success: true }));

// ── Admin: Users ──────────────────────────────────────────────────────────────

app.get("/api/admin/users", requireSuper, async (_req, res) => {
  try { res.json((await q("SELECT * FROM users WHERE is_admin=true")).map(u=>({...u,password:undefined}))); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/admin/users", requireSuper, async (req, res) => {
  try {
    const b = req.body;
    const [u] = await q(
      "INSERT INTO users (id,username,password,is_admin,is_super_admin,permissions,created_at) VALUES ($1,$2,$3,true,$4,$5,NOW()) RETURNING *",
      [crypto.randomUUID(), b.username, hashPw(b.password), b.isSuperAdmin??false, JSON.stringify(b.permissions||{})]
    );
    res.json({ ...u, password: undefined });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/admin/users/:id", requireSuper, async (req, res) => {
  try {
    const b = req.body;
    const pw = b.password ? hashPw(b.password) : null;
    const [u] = await q(
      "UPDATE users SET username=COALESCE($1,username), password=COALESCE($2,password), is_super_admin=COALESCE($3,is_super_admin) WHERE id=$4 RETURNING *",
      [b.username, pw, b.isSuperAdmin, req.params.id]
    );
    res.json({ ...u, password: undefined });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/admin/users/:id", requireSuper, async (req, res) => {
  try { await q("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Newsletter ────────────────────────────────────────────────────────────────

app.post("/api/newsletter/subscribe", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    await q("INSERT INTO newsletter_subscribers (id,email,name,is_active,created_at) VALUES ($1,$2,$3,true,NOW()) ON CONFLICT DO NOTHING",
      [crypto.randomUUID(), email, name||null]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/admin/email-logs", requireAdmin, async (_req, res) => {
  try { res.json(await q("SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 100")); }
  catch { res.json([]); }
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: "Not found" }));

module.exports = app;
