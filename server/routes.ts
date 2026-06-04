import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { z } from "zod";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { seedDatabase } from "./seed";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { ObjectStorageService } from "./integrations/object_storage";

import { computeFeatureFlags } from "./feature-flags";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (PNG, JPG, WEBP, GIF) are allowed"));
    }
  },
});

const coaUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (PNG, JPG, WEBP, GIF) and PDF files are allowed"));
    }
  },
});

const PgSession = pgSession(session);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any)?.adminUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const adminUser = (req.session as any)?.adminUser;
  if (!adminUser) return res.status(401).json({ message: "Unauthorized" });
  if (!adminUser.isSuperAdmin) return res.status(403).json({ message: "Forbidden" });
  next();
}

function requireTab(tab: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const adminUser = (req.session as any)?.adminUser;
    if (!adminUser) return res.status(401).json({ message: "Unauthorized" });
    if (adminUser.isSuperAdmin) return next();
    const allowedTabs: string[] = adminUser.permissions?.tabs ?? [];
    if (allowedTabs.includes(tab)) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}

function requireSettingsSection(section: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const adminUser = (req.session as any)?.adminUser;
    if (!adminUser) return res.status(401).json({ message: "Unauthorized" });
    if (adminUser.isSuperAdmin) return next();
    const allowedTabs: string[] = adminUser.permissions?.tabs ?? [];
    if (!allowedTabs.includes("settings")) return res.status(403).json({ message: "Forbidden" });
    const sections: string[] | undefined = adminUser.permissions?.settingsSections;
    if (!sections || sections.length === 0) return next();
    if (sections.includes(section)) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PgSession({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "aura-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  await import("drizzle-orm").then(async ({ sql }) => {
    const { db: database } = await import("./storage");
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT false
      )
    `);
    await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false`);
    await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"tabs": []}'::jsonb`);
    await database.execute(sql`
      UPDATE users SET is_super_admin = true
      WHERE is_admin = true
        AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = true AND is_super_admin = true)
        AND id = (SELECT id FROM users WHERE is_admin = true ORDER BY id LIMIT 1)
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        subtitle TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        contents TEXT NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'peptide',
        in_stock BOOLEAN NOT NULL DEFAULT true,
        featured BOOLEAN NOT NULL DEFAULT false,
        research_highlights TEXT[] NOT NULL DEFAULT '{}'::text[]
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        phone TEXT,
        stripe_session_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        items JSONB NOT NULL,
        total INTEGER NOT NULL,
        shipping_address JSONB,
        shipping_method TEXT,
        tracking_number TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT`);
    await database.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB`);
    await database.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT`);
    await database.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT`);
    await database.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT`);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'image',
        thumbnail_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS shipping_options (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        phone TEXT,
        shipping_address JSONB,
        order_count INTEGER NOT NULL DEFAULT 0,
        total_spent INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        template_type TEXT NOT NULL,
        order_id VARCHAR,
        tracking_number TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        error_message TEXT,
        html_content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS abandoned_carts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        items JSONB NOT NULL,
        subtotal INTEGER NOT NULL,
        reminder_sent BOOLEAN NOT NULL DEFAULT false,
        converted_to_order BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        subscribed BOOLEAN NOT NULL DEFAULT true,
        source TEXT NOT NULL DEFAULT 'website',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id VARCHAR,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        code TEXT NOT NULL UNIQUE,
        commission_rate INTEGER NOT NULL DEFAULT 10,
        referral_discount INTEGER NOT NULL DEFAULT 10,
        active BOOLEAN NOT NULL DEFAULT true,
        approved BOOLEAN NOT NULL DEFAULT false,
        paypal_email TEXT,
        venmo_handle TEXT,
        cashapp_handle TEXT,
        zelle_contact TEXT,
        payout_method TEXT,
        email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
        magic_token TEXT,
        magic_token_expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await database.execute(sql`
      CREATE TABLE IF NOT EXISTS affiliate_referrals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        affiliate_id VARCHAR NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        order_id VARCHAR,
        order_total INTEGER,
        commission_amount INTEGER,
        status TEXT NOT NULL DEFAULT 'clicked',
        is_recurring BOOLEAN NOT NULL DEFAULT false,
        clicked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        converted_at TIMESTAMP
      )
    `);
    const existingShipping = await database.execute(sql`SELECT COUNT(*) as count FROM shipping_options`);
    const shippingCount = Number((existingShipping.rows[0] as any).count);
    if (shippingCount === 0) {
      await database.execute(sql`
        INSERT INTO shipping_options (name, description, price, enabled, sort_order) VALUES
        ('Standard Shipping', 'Flat rate shipping', 999, true, 0),
        ('Local Pickup – St George', 'Red Rock / DexaFit, 1841 E Riverside Drive, Suite 202, St George, UT 84790, Second Floor', 0, true, 1)
      `);
      console.log("Seeded default shipping options");
    }
  });

  const { registerObjectStorageRoutes } = await import("./integrations/object_storage");
  registerObjectStorageRoutes(app);

  const { registerImageRoutes } = await import("./integrations/ai_image");
  registerImageRoutes(app, requireTab("products"));

  await seedDatabase();

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const { registerStripeRoutes } = await import("./stripe-checkout");
  registerStripeRoutes(app);

  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isAdmin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      (req.session as any).adminUser = {
        id: user.id,
        username: user.username,
        isSuperAdmin: user.isSuperAdmin === true,
        permissions: user.permissions ?? { tabs: [] },
      };
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/admin/session", async (req, res) => {
    const sessionUser = (req.session as any)?.adminUser;
    if (!sessionUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const fresh = await storage.getUser(sessionUser.id);
    if (!fresh || !fresh.isAdmin) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }
    const refreshed = {
      id: fresh.id,
      username: fresh.username,
      isSuperAdmin: fresh.isSuperAdmin === true,
      permissions: fresh.permissions ?? { tabs: [] },
    };
    (req.session as any).adminUser = refreshed;
    res.json({ user: refreshed });
  });

  app.get("/api/admin/users", requireSuperAdmin, async (_req, res) => {
    try {
      const list = await storage.listAdminUsers();
      res.json(list.map(u => ({
        id: u.id,
        username: u.username,
        isSuperAdmin: u.isSuperAdmin === true,
        permissions: u.permissions ?? { tabs: [] },
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const { createAdminUserSchema } = await import("@shared/schema");
      const parsed = createAdminUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const user = await storage.createAdminUser({
        username: parsed.data.username,
        passwordHash: hashPassword(parsed.data.password),
        isSuperAdmin: parsed.data.isSuperAdmin,
        permissions: parsed.data.permissions,
      });
      res.json({
        id: user.id,
        username: user.username,
        isSuperAdmin: user.isSuperAdmin === true,
        permissions: user.permissions ?? { tabs: [] },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req.session as any).adminUser;
      const { updateAdminUserSchema } = await import("@shared/schema");
      const parsed = updateAdminUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const target = await storage.getUser(id);
      if (!target || !target.isAdmin) {
        return res.status(404).json({ message: "Admin user not found" });
      }
      if (parsed.data.username && parsed.data.username !== target.username) {
        const existing = await storage.getUserByUsername(parsed.data.username);
        if (existing && existing.id !== id) {
          return res.status(409).json({ message: "Username already taken" });
        }
      }
      if (parsed.data.isSuperAdmin === false && sessionUser.id === id) {
        return res.status(400).json({ message: "You can't demote your own super-admin status" });
      }
      if (parsed.data.isSuperAdmin === false && target.isSuperAdmin === true) {
        const { sql: drizzleSql } = await import("drizzle-orm");
        const result = await db.execute(drizzleSql`
          UPDATE users SET is_super_admin = false
          WHERE id = ${id}
            AND is_super_admin = true
            AND (SELECT COUNT(*) FROM users WHERE is_admin = true AND is_super_admin = true) > 1
          RETURNING id
        `);
        if (!result.rows || result.rows.length === 0) {
          return res.status(400).json({ message: "Cannot demote the last super admin" });
        }
      }
      const updated = await storage.updateAdminUser(id, {
        username: parsed.data.username,
        passwordHash: parsed.data.password ? hashPassword(parsed.data.password) : undefined,
        isSuperAdmin: parsed.data.isSuperAdmin,
        permissions: parsed.data.permissions,
      });
      if (!updated) return res.status(404).json({ message: "Admin user not found" });
      if (sessionUser.id === id) {
        (req.session as any).adminUser = {
          id: updated.id,
          username: updated.username,
          isSuperAdmin: updated.isSuperAdmin === true,
          permissions: updated.permissions ?? { tabs: [] },
        };
      }
      res.json({
        id: updated.id,
        username: updated.username,
        isSuperAdmin: updated.isSuperAdmin === true,
        permissions: updated.permissions ?? { tabs: [] },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req.session as any).adminUser;
      if (sessionUser.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      const target = await storage.getUser(id);
      if (!target || !target.isAdmin) {
        return res.status(404).json({ message: "Admin user not found" });
      }
      const { sql: drizzleSql } = await import("drizzle-orm");
      const result = await db.execute(drizzleSql`
        DELETE FROM users
        WHERE id = ${id}
          AND (
            is_super_admin = false
            OR (SELECT COUNT(*) FROM users WHERE is_admin = true AND is_super_admin = true) > 1
          )
        RETURNING id
      `);
      if (!result.rows || result.rows.length === 0) {
        return res.status(400).json({ message: "Cannot delete the last super admin" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/products", requireTab("products"), async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/products", requireTab("products"), async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/products/:id", requireTab("products"), async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.use("/uploads", express.static(uploadDir));
  app.use("/images", express.static(path.join(process.cwd(), "public", "images")));

  // Public image serving — reads from DB, no auth needed
  app.get("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const img = await storage.getImage(req.params.id);
      if (!img) return res.status(404).json({ message: "Image not found" });
      const buf = Buffer.from(img.data, "base64");
      res.set("Content-Type", img.contentType);
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to serve image" });
    }
  });

  // Admin image upload — stores in DB as base64, returns /api/images/:id URL
  app.post("/api/admin/upload", requireTab("products"), upload.single("image"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      try { fs.unlinkSync(req.file.path); } catch {}
      const base64 = fileBuffer.toString("base64");
      const id = await storage.saveImage(base64, req.file.mimetype);
      res.json({ imageUrl: `/api/images/${id}` });
    } catch (error: any) {
      try { fs.unlinkSync(req.file.path); } catch {}
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Image upload failed. Please try again." });
    }
  });

  app.delete("/api/admin/products/:id", requireTab("products"), async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/orders", requireTab("orders"), async (_req, res) => {
    try {
      const allOrders = await storage.getOrders();
      res.json(allOrders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/checkout/invoice", async (req, res) => {
    try {
      const { email, phone, items: cartItems, shippingOptionId, shippingAddress } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!cartItems || cartItems.length === 0) return res.status(400).json({ message: "Cart is empty" });

      const products = await storage.getProducts();
      const orderItems: any[] = [];

      for (const ci of cartItems) {
        const product = products.find(p => p.id === ci.productId);
        if (!product) return res.status(400).json({ message: `Product not found: ${ci.productId}` });
        orderItems.push({ name: product.name, price: product.price, quantity: ci.quantity });
      }

      let shippingCostDollars = 0;
      let shippingMethodName = "Standard Shipping";
      let shippingAddr: any = shippingAddress || null;

      if (shippingOptionId) {
        const option = await storage.getShippingOptionById(shippingOptionId);
        if (option) {
          shippingMethodName = option.name;
          const productSubtotal = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
          const freeThresholdRaw = await storage.getSetting("free_shipping_threshold");
          const freeThreshold = freeThresholdRaw ? parseInt(freeThresholdRaw, 10) : 0;
          const qualifiesFree = freeThreshold > 0 && productSubtotal >= freeThreshold && option.price > 0;
          shippingCostDollars = qualifiesFree ? 0 : option.price / 100;
          if (option.price === 0) {
            shippingAddr = { pickup: true, location: option.description };
          }
        }
      }

      if (shippingCostDollars > 0) {
        orderItems.push({ name: shippingMethodName, price: shippingCostDollars, quantity: 1, isShipping: true });
      }

      const total = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

      const order = await storage.createOrder({
        email,
        phone: phone || null,
        stripeSessionId: null,
        status: "pending",
        paymentMethod: "invoice",
        items: orderItems,
        total,
        shippingAddress: shippingAddr,
        shippingMethod: shippingMethodName,
        trackingNumber: null,
        carrier: null,
      });

      try { await storage.upsertCustomer({ email, phone: phone || undefined, shippingAddress: shippingAddr || undefined, orderTotal: total, incrementOrder: true }); } catch {}

      try {
        const { sendInvoiceRequestEmail, sendAdminInvoiceAlert } = await import("./email");
        sendInvoiceRequestEmail(email, order).catch(console.error);
        sendAdminInvoiceAlert(order).catch(console.error);
      } catch {}

      res.json({ orderId: order.id, total });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/orders/:id/send-invoice", requireTab("orders"), async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const { sendInvoiceEmail } = await import("./email");
      await sendInvoiceEmail(order.email, order);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/orders/:id/mark-paid", requireTab("orders"), async (req, res) => {
    try {
      await storage.updateOrder(req.params.id, { status: "paid" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/orders", requireTab("orders"), async (req, res) => {
    try {
      const { email, phone, name, address, items, shippingLabel, shippingPrice, status, sendEmail } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!items || items.length === 0) return res.status(400).json({ message: "At least one item is required" });

      const orderItems: any[] = items.map((i: any) => ({
        name: i.name,
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
      }));

      if (shippingPrice && Number(shippingPrice) > 0) {
        orderItems.push({ name: shippingLabel || "Shipping", price: Number(shippingPrice), quantity: 1, isShipping: true });
      }

      const total = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

      const shippingAddress = address ? { name: name || "", ...address } : null;

      const order = await storage.createOrder({
        email,
        phone: phone || null,
        stripeSessionId: null,
        status: status || "paid",
        items: orderItems,
        total,
        shippingAddress,
        shippingMethod: shippingLabel || null,
        trackingNumber: null,
        carrier: null,
      });

      try {
        await storage.upsertCustomer({
          email,
          name: name || undefined,
          phone: phone || undefined,
          shippingAddress: shippingAddress || undefined,
          orderTotal: total,
          incrementOrder: true,
        });
      } catch {}

      if (sendEmail) {
        try {
          const { sendOrderConfirmationEmail } = await import("./email");
          await sendOrderConfirmationEmail(email, order);
        } catch (emailErr: any) {
          console.error("Manual order email error:", emailErr.message);
        }
      }

      res.json(order);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/orders/:id/packing-slip", requireTab("orders"), async (req, res) => {
    const enabled = await storage.getSetting("feature_packing_slip_enabled");
    if (enabled === "false") {
      return res.status(404).json({ message: "Packing slip feature is disabled" });
    }
    const { packingSlipHandler } = await import("./packing-slip");
    return packingSlipHandler(req, res);
  });

  app.get("/api/admin/reconstitution-guide", requireTab("products"), async (req, res) => {
    const enabled = await storage.getSetting("feature_reconstitution_guide_enabled");
    if (enabled === "false") {
      return res.status(404).json({ message: "Reconstitution guide feature is disabled" });
    }
    const { reconstitutionGuideHandler } = await import("./reconstitution-guide");
    return reconstitutionGuideHandler(req, res);
  });

  app.patch("/api/admin/orders/:id", requireTab("orders"), async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.status !== undefined) {
        const validStatuses = ["pending", "paid", "completed", "picked_up", "cancelled", "failed"];
        if (!validStatuses.includes(req.body.status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        updates.status = req.body.status;
      }
      if (req.body.trackingNumber !== undefined) {
        updates.trackingNumber = req.body.trackingNumber || null;
      }
      if (req.body.carrier !== undefined) {
        updates.carrier = req.body.carrier || null;
      }
      await storage.updateOrder(req.params.id, updates);

      if (updates.status === "completed") {
        try {
          const order = await storage.getOrderById(req.params.id);
          if (order && order.email) {
            const { sendShippedEmail } = await import("./email");
            const tracking = req.body.trackingNumber || order.trackingNumber || undefined;
            const carrier = req.body.carrier || (order as any).carrier || undefined;
            sendShippedEmail(order.email, order, tracking, carrier).catch(err =>
              console.error("Shipped email error:", err)
            );
          }
        } catch (err) {
          console.error("Shipped email trigger error:", err);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/certificates", async (_req, res) => {
    try {
      const certs = await storage.getCertificates();
      // Map snake_case DB columns to camelCase for frontend
      const mapped = certs.map((c: any) => ({
        id: c.id,
        productId: c.productId ?? c.product_id ?? null,
        productName: c.productName ?? c.product_name ?? "",
        batchNumber: c.batchNumber ?? c.batch_number ?? "",
        purity: c.purity ?? null,
        testedBy: c.testedBy ?? c.tested_by ?? null,
        testDate: c.testDate ?? c.test_date ?? null,
        fileUrl: c.fileUrl ?? c.file_url ?? null,
        fileType: c.fileType ?? c.file_type ?? null,
        title: c.title ?? null,
        thumbnailUrl: c.thumbnailUrl ?? c.thumbnail_url ?? null,
        notes: c.notes ?? null,
        createdAt: c.createdAt ?? c.created_at ?? null,
      }));
      res.json(mapped);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  function generatePdfThumbnail(pdfPath: string): string | null {
    try {
      const baseName = path.basename(pdfPath, path.extname(pdfPath));
      const thumbName = `${baseName}-thumb`;
      const thumbDir = path.dirname(pdfPath);
      execSync(
        `pdftoppm -png -f 1 -l 1 -scale-to 600 "${pdfPath}" "${path.join(thumbDir, thumbName)}"`,
        { timeout: 15000 }
      );
      const generatedFile = `${thumbName}-1.png`;
      const generatedPath = path.join(thumbDir, generatedFile);
      if (fs.existsSync(generatedPath)) {
        return `/uploads/${generatedFile}`;
      }
      const altFile = `${thumbName}-01.png`;
      const altPath = path.join(thumbDir, altFile);
      if (fs.existsSync(altPath)) {
        return `/uploads/${altFile}`;
      }
      return null;
    } catch (err) {
      console.error("PDF thumbnail generation failed:", err);
      return null;
    }
  }

  async function uploadFileToStorage(filePath: string, contentType: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");
    const id = await storage.saveImage(base64, contentType);
    return `/api/images/${id}`;
  }

  app.post("/api/admin/certificates", requireTab("certificates"), coaUpload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }
      const ext = path.extname(req.file.originalname).toLowerCase();
      const fileType = ext === ".pdf" ? "pdf" : "image";
      const title = req.body.title || req.file.originalname;
      const localPath = req.file.path;

      let fileUrl: string;
      let thumbnailUrl: string | null = null;

      try {
        fileUrl = await uploadFileToStorage(localPath, req.file.mimetype);

        if (fileType === "image") {
          thumbnailUrl = fileUrl;
        } else if (fileType === "pdf") {
          const thumbResult = generatePdfThumbnail(localPath);
          if (thumbResult) {
            const thumbLocalPath = path.join(uploadDir, path.basename(thumbResult));
            if (fs.existsSync(thumbLocalPath)) {
              try {
                thumbnailUrl = await uploadFileToStorage(thumbLocalPath, "image/png");
              } catch (thumbErr) {
                console.error("Thumbnail upload failed, COA still saved:", thumbErr);
              } finally {
                try { fs.unlinkSync(thumbLocalPath); } catch {}
              }
            }
          }
        }
      } catch (objErr: any) {
        try { fs.unlinkSync(localPath); } catch {}
        console.error("Object storage upload failed for certificate:", objErr);
        return res.status(500).json({ message: "Certificate upload failed. Please try again." });
      }

      try { fs.unlinkSync(localPath); } catch {}

      const certData = { title, fileUrl, fileType, thumbnailUrl };
      const { insertCertificateSchema } = await import("@shared/schema");
      const parsed = insertCertificateSchema.parse(certData);
      const cert = await storage.createCertificate(parsed);
      res.json(cert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/certificates/:id", requireTab("certificates"), async (req, res) => {
    try {
      const { title } = req.body;
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ message: "Title is required" });
      }
      const cert = await storage.updateCertificate(req.params.id, { title: title.trim() });
      if (!cert) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      res.json(cert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/certificates/:id", requireTab("certificates"), async (req, res) => {
    try {
      await storage.deleteCertificate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/shipping-options", async (_req, res) => {
    try {
      const options = await storage.getShippingOptions();
      res.json(options.filter(o => o.enabled));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/shipping-options", requireSettingsSection("shipping"), async (_req, res) => {
    try {
      const options = await storage.getShippingOptions();
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/shipping-options", requireSettingsSection("shipping"), async (req, res) => {
    try {
      const { name, description, price, enabled, sortOrder } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }
      if (typeof price !== "number" || isNaN(price) || price < 0) {
        return res.status(400).json({ message: "Price must be a non-negative number" });
      }
      const option = await storage.createShippingOption({
        name: name.trim(),
        description: description || null,
        price: Math.round(price),
        enabled: enabled !== false,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      });
      res.json(option);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/shipping-options/:id", requireSettingsSection("shipping"), async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.name !== undefined) {
        if (typeof req.body.name !== "string" || !req.body.name.trim()) {
          return res.status(400).json({ message: "Name cannot be empty" });
        }
        updates.name = req.body.name.trim();
      }
      if (req.body.price !== undefined) {
        if (typeof req.body.price !== "number" || isNaN(req.body.price) || req.body.price < 0) {
          return res.status(400).json({ message: "Price must be a non-negative number" });
        }
        updates.price = Math.round(req.body.price);
      }
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
      if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
      const option = await storage.updateShippingOption(req.params.id, updates);
      if (!option) {
        return res.status(404).json({ message: "Shipping option not found" });
      }
      res.json(option);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/shipping-options/:id", requireSettingsSection("shipping"), async (req, res) => {
    try {
      await storage.deleteShippingOption(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/config/google-maps-key", (_req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY || "";
    res.json({ key: key || null });
  });

  app.get("/api/settings/free-shipping-threshold", async (_req, res) => {
    try {
      const val = await storage.getSetting("free_shipping_threshold");
      res.json({ threshold: val !== null ? parseInt(val, 10) : null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/settings/free-shipping-threshold", requireSettingsSection("freeShipping"), async (req, res) => {
    try {
      const { threshold } = req.body;
      if (threshold === null || threshold === 0) {
        await storage.setSetting("free_shipping_threshold", "0");
        return res.json({ threshold: 0 });
      }
      const val = parseInt(threshold, 10);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ message: "Threshold must be a positive number or 0 to disable" });
      }
      await storage.setSetting("free_shipping_threshold", String(val));
      res.json({ threshold: val });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/payment-methods", async (_req, res) => {
    try {
      const stripe = await storage.getSetting("payment_stripe_enabled");
      const invoice = await storage.getSetting("payment_invoice_enabled");
      res.json({
        stripeEnabled: stripe !== "false",
        invoiceEnabled: invoice === "true",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/settings/payment-methods", requireSettingsSection("payments"), async (req, res) => {
    try {
      const { stripeEnabled, invoiceEnabled } = req.body;
      if (stripeEnabled !== undefined) await storage.setSetting("payment_stripe_enabled", stripeEnabled ? "true" : "false");
      if (invoiceEnabled !== undefined) await storage.setSetting("payment_invoice_enabled", invoiceEnabled ? "true" : "false");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/feature-flags", async (_req, res) => {
    try {
      const flags = await computeFeatureFlags();
      res.json(flags);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const featureFlagsPatchSchema = z
    .object({
      emails: z.boolean().optional(),
      affiliates: z.boolean().optional(),
      aiImage: z.boolean().optional(),
      packingSlip: z.boolean().optional(),
      reconstitutionGuide: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, {
      message: "Provide at least one flag to update",
    });

  app.patch("/api/admin/feature-flags", requireSettingsSection("features"), async (req, res) => {
    const parsed = featureFlagsPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid feature flag payload" });
    }
    try {
      const { emails, affiliates, aiImage, packingSlip, reconstitutionGuide } = parsed.data;
      if (emails !== undefined) {
        await storage.setSetting("feature_emails_enabled", emails ? "true" : "false");
      }
      if (affiliates !== undefined) {
        await storage.setSetting("feature_affiliates_enabled", affiliates ? "true" : "false");
      }
      if (aiImage !== undefined) {
        await storage.setSetting("feature_ai_image_enabled", aiImage ? "true" : "false");
      }
      if (packingSlip !== undefined) {
        await storage.setSetting("feature_packing_slip_enabled", packingSlip ? "true" : "false");
      }
      if (reconstitutionGuide !== undefined) {
        await storage.setSetting("feature_reconstitution_guide_enabled", reconstitutionGuide ? "true" : "false");
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const requireAffiliatesEnabled = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const val = await storage.getSetting("feature_affiliates_enabled");
      if (val === "false") {
        return res.status(404).json({ message: "Affiliate program is currently unavailable" });
      }
      next();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  app.get("/api/settings/affiliate-banner", async (_req, res) => {
    try {
      const val = await storage.getSetting("affiliate_banner_enabled");
      res.json({ enabled: val !== "false" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/settings/affiliate-banner", requireSettingsSection("affiliateBanner"), async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.setSetting("affiliate_banner_enabled", enabled ? "true" : "false");
      res.json({ enabled: !!enabled });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/customers", requireTab("customers"), async (_req, res) => {
    try {
      const allCustomers = await storage.getCustomers();
      res.json(allCustomers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      await storage.subscribeEmail(email.toLowerCase().trim(), "website");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/unsubscribe", async (req, res) => {
    try {
      const token = req.query.t as string;
      if (!token) {
        return res.status(400).send("Invalid unsubscribe link.");
      }
      const { decryptEmailToken, encryptEmailToken } = await import("./email");
      const email = decryptEmailToken(token);
      if (!email) {
        return res.status(400).send("Invalid or expired unsubscribe link.");
      }
      await storage.unsubscribeEmail(email);
      const resubToken = encryptEmailToken(email);
      const siteUrl = process.env.SITE_URL || "https://aurapepts.com";
      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — Aura Peptides</title>
<style>body{margin:0;padding:40px 20px;font-family:'Helvetica Neue',sans-serif;background:#f5f3ef;text-align:center;}
.card{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:48px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
h1{color:#201C16;font-size:22px;margin:0 0 12px;}
p{color:#6B6258;font-size:14px;margin:0 0 8px;line-height:1.5;}
.email{font-weight:600;color:#201C16;}
.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:#201C16;color:#fff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;}
.note{margin-top:24px;font-size:12px;color:#9DA2B3;}</style></head>
<body><div class="card">
<h1>You've Been Unsubscribed</h1>
<p>The email <span class="email">${email}</span> has been removed from our mailing list.</p>
<p>You will still receive order confirmations and shipping notifications.</p>
<a href="${siteUrl}/resubscribe?t=${resubToken}" class="btn">Resubscribe</a>
<p class="note">Changed your mind? Click the button above to resubscribe.</p>
</div></body></html>`);
    } catch (error: any) {
      res.status(500).send("Something went wrong. Please try again.");
    }
  });

  app.post("/api/resubscribe", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      const { decryptEmailToken } = await import("./email");
      const email = decryptEmailToken(token);
      if (!email) {
        return res.status(400).json({ message: "Invalid token" });
      }
      await storage.subscribeEmail(email);
      res.json({ success: true, email });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/newsletter", requireTab("customers"), async (_req, res) => {
    try {
      const [subscribers, allCustomers] = await Promise.all([
        storage.getNewsletterSubscribers(),
        storage.getCustomers(),
      ]);

      const contactMap = new Map<string, {
        email: string;
        name: string | null;
        source: string;
        subscribed: boolean;
        subscriberId: string | null;
        customerId: string | null;
        orderCount: number;
        totalSpent: number;
        createdAt: string;
      }>();

      for (const sub of subscribers) {
        contactMap.set(sub.email, {
          email: sub.email,
          name: null,
          source: sub.source,
          subscribed: sub.subscribed,
          subscriberId: sub.id,
          customerId: null,
          orderCount: 0,
          totalSpent: 0,
          createdAt: sub.createdAt.toISOString(),
        });
      }

      for (const cust of allCustomers) {
        const existing = contactMap.get(cust.email);
        if (existing) {
          existing.name = cust.name || existing.name;
          existing.customerId = cust.id;
          existing.orderCount = cust.orderCount;
          existing.totalSpent = cust.totalSpent;
        } else {
          contactMap.set(cust.email, {
            email: cust.email,
            name: cust.name,
            source: "customer",
            subscribed: true,
            subscriberId: null,
            customerId: cust.id,
            orderCount: cust.orderCount,
            totalSpent: cust.totalSpent,
            createdAt: cust.createdAt.toISOString(),
          });
        }
      }

      const contacts = Array.from(contactMap.values());
      contacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/newsletter/toggle", requireTab("customers"), async (req, res) => {
    try {
      const { email, subscribed } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      if (subscribed) {
        await storage.subscribeEmail(email, "admin");
      } else {
        await storage.unsubscribeEmail(email);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/newsletter/:id", requireTab("customers"), async (req, res) => {
    try {
      await storage.deleteNewsletterSubscriber(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/customers/:id/newsletter", requireTab("customers"), async (req, res) => {
    try {
      const { subscribed } = req.body;
      const allCustomers = await storage.getCustomers();
      const customer = allCustomers.find(c => c.id === req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      if (subscribed) {
        await storage.subscribeEmail(customer.email, "admin");
      } else {
        await storage.unsubscribeEmail(customer.email);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/email-templates/preview/:type", requireTab("emails"), async (req, res) => {
    try {
      const { generateTemplatePreview } = await import("./email");
      const preview = generateTemplatePreview(req.params.type);
      if (!preview) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/email-templates/test/:type", requireTab("emails"), async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      const { generateTemplatePreview, sendViaProvider } = await import("./email");
      const preview = generateTemplatePreview(req.params.type);
      if (!preview) {
        return res.status(404).json({ message: "Template not found" });
      }
      await sendViaProvider({ to: email, subject: `[TEST] ${preview.subject}`, html: preview.html });
      await storage.createEmailLog({
        toEmail: email,
        subject: `[TEST] ${preview.subject}`,
        templateType: req.params.type,
        status: "sent",
        htmlContent: preview.html,
      });
      res.json({ success: true });
    } catch (error: any) {
      const msg = error.message || "";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ message: "Name, email, and message are required" });
      }
      const { sendContactFormEmail } = await import("./email");
      sendContactFormEmail(name, email, message, phone || "").catch(err =>
        console.error("Contact form email error:", err)
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/email-logs", requireTab("emails"), async (_req, res) => {
    try {
      const logs = await storage.getEmailLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/email-settings", requireSettingsSection("emails"), async (_req, res) => {
    try {
      const gmailUser = await storage.getSetting("gmail_user");
      const gmailPass = await storage.getSetting("gmail_app_password");
      const adminNotifyEmail = await storage.getSetting("admin_notify_email");
      const adminBccEmail = await storage.getSetting("admin_bcc_email");
      const emailProvider = await storage.getSetting("email_provider") || "gmail";
      const resendApiKey = await storage.getSetting("resend_api_key");
      const resendFromEmail = await storage.getSetting("resend_from_email");
      res.json({
        gmailUser: gmailUser || "",
        gmailAppPassword: gmailPass ? "••••••••" : "",
        hasPassword: !!gmailPass,
        adminNotifyEmail: adminNotifyEmail || "admin@aurapepts.com",
        adminBccEmail: adminBccEmail || "",
        emailProvider,
        resendApiKey: resendApiKey ? "••••••••" : "",
        hasResendKey: !!resendApiKey,
        resendFromEmail: resendFromEmail || "",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/email-settings", requireTab("emails"), async (req, res) => {
    try {
      const { gmailUser, gmailAppPassword, adminNotifyEmail, adminBccEmail, emailProvider, resendApiKey, resendFromEmail } = req.body;
      if (gmailUser !== undefined) await storage.setSetting("gmail_user", gmailUser);
      if (gmailAppPassword !== undefined && gmailAppPassword !== "••••••••") {
        await storage.setSetting("gmail_app_password", gmailAppPassword.replace(/\s/g, ""));
      }
      if (adminNotifyEmail !== undefined) await storage.setSetting("admin_notify_email", adminNotifyEmail);
      if (adminBccEmail !== undefined) await storage.setSetting("admin_bcc_email", (adminBccEmail || "").trim());
      if (emailProvider !== undefined) await storage.setSetting("email_provider", emailProvider);
      if (resendApiKey !== undefined && resendApiKey !== "••••••••") {
        await storage.setSetting("resend_api_key", resendApiKey.trim());
      }
      if (resendFromEmail !== undefined) await storage.setSetting("resend_from_email", resendFromEmail.trim());
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/test-email", requireTab("emails"), async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      const { sendViaProvider } = await import("./email");
      const testSubject = "Test Email — Aura Peptides";
      const testHtml = "<h2>Test Email</h2><p>Your email configuration is working correctly.</p>";
      await sendViaProvider({ to: email, subject: testSubject, html: testHtml });
      await storage.createEmailLog({
        toEmail: email,
        subject: testSubject,
        templateType: "test",
        status: "sent",
        htmlContent: testHtml,
      });
      res.json({ success: true });
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("Username and Password not accepted") || msg.includes("Invalid login")) {
        return res.status(400).json({ message: "Gmail rejected the credentials. Make sure you're using a Gmail App Password (not your regular password) and that 2-Step Verification is enabled on the Google account." });
      }
      res.status(500).json({ message: msg });
    }
  });

  // ── Affiliate Routes (Public) ────────────────────────────────────────────

  app.post("/api/affiliate/click", requireAffiliatesEnabled, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Referral code is required" });
      const affiliate = await storage.getAffiliateByCode(code.toLowerCase());
      if (!affiliate || !affiliate.active || !affiliate.approved) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      const sessionToken = crypto.randomUUID();
      await storage.createAffiliateReferral({ affiliateId: affiliate.id, sessionToken });
      res.json({ sessionToken, discount: affiliate.referralDiscount, affiliateName: affiliate.name });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/affiliate/signup", requireAffiliatesEnabled, async (req, res) => {
    try {
      const { name, email, phone, code, payoutMethod, payoutHandle } = req.body;
      if (!name || !email || !code) return res.status(400).json({ message: "Name, email, and referral code are required" });
      if (!/^[a-zA-Z0-9]{1,10}$/.test(code)) return res.status(400).json({ message: "Code must be 1-10 alphanumeric characters" });
      const existingEmail = await storage.getAffiliateByEmail(email);
      if (existingEmail) return res.status(400).json({ message: "An affiliate with this email already exists" });
      const existingCode = await storage.getAffiliateByCode(code);
      if (existingCode) return res.status(400).json({ message: "This referral code is already taken" });
      const payoutFields: any = {};
      if (payoutMethod) payoutFields.payoutMethod = payoutMethod;
      if (payoutMethod === "paypal") payoutFields.paypalEmail = payoutHandle;
      else if (payoutMethod === "venmo") payoutFields.venmoHandle = payoutHandle;
      else if (payoutMethod === "cashapp") payoutFields.cashappHandle = payoutHandle;
      else if (payoutMethod === "zelle") payoutFields.zelleContact = payoutHandle;
      await storage.createAffiliate({ name, email, phone: phone || null, code, ...payoutFields });
      res.json({ success: true, message: "Application received! We'll review it within 1-2 business days." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/affiliate/request-magic-link", requireAffiliatesEnabled, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const affiliate = await storage.getAffiliateByEmail(email);
      if (!affiliate) return res.json({ success: true });
      if (!affiliate.approved || !affiliate.active) return res.json({ success: true });
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await storage.updateAffiliate(affiliate.id, { magicToken: token, magicTokenExpiresAt: expires } as any);
      const siteUrl = process.env.SITE_URL || "https://aurapepts.com";
      const magicUrl = `${siteUrl}/affiliates?magic=${token}`;
      const { sendViaProvider } = await import("./email");
      const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#201C16;margin:0 0 12px;">Your Affiliate Dashboard Access</h2>
        <p style="color:#6B6258;font-size:14px;">Click the button below to sign into your Aura Peptides affiliate dashboard. This link expires in 15 minutes.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${magicUrl}" style="display:inline-block;padding:14px 36px;background:#201C16;color:#fff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">Sign In to Dashboard</a>
        </div>
        <p style="color:#9DA2B3;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>`;
      await sendViaProvider({ to: affiliate.email, subject: "Your Affiliate Dashboard Link — Aura Peptides", html });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/affiliate/verify-magic-link", requireAffiliatesEnabled, async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ message: "Token is required" });
      const affiliate = await storage.getAffiliateByMagicToken(token);
      if (!affiliate || !affiliate.magicTokenExpiresAt || new Date(affiliate.magicTokenExpiresAt) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired link" });
      }
      const sessionToken = crypto.randomUUID();
      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.updateAffiliate(affiliate.id, { magicToken: sessionToken, magicTokenExpiresAt: sessionExpires } as any);
      res.json({ success: true, affiliateSessionToken: sessionToken });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function getAffiliateFromSession(req: Request): Promise<any | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const affiliate = await storage.getAffiliateByMagicToken(token);
    if (!affiliate || !affiliate.magicTokenExpiresAt || new Date(affiliate.magicTokenExpiresAt) < new Date()) return null;
    if (!affiliate.approved || !affiliate.active) return null;
    return affiliate;
  }

  app.get("/api/affiliate/me", requireAffiliatesEnabled, async (req, res) => {
    try {
      const affiliate = await getAffiliateFromSession(req);
      if (!affiliate) return res.status(401).json({ message: "Not authenticated" });
      const referrals = await storage.getAffiliateReferrals(affiliate.id);
      const totalClicks = referrals.length;
      const conversions = referrals.filter(r => r.status === "converted" || r.status === "paid");
      const totalSales = conversions.length;
      const conversionRate = totalClicks > 0 ? Math.round((totalSales / totalClicks) * 100) : 0;
      const pendingPayout = referrals.filter(r => r.status === "converted").reduce((s, r) => s + (r.commissionAmount || 0), 0);
      const totalEarned = conversions.reduce((s, r) => s + (r.commissionAmount || 0), 0);
      res.json({
        id: affiliate.id, name: affiliate.name, email: affiliate.email, phone: affiliate.phone,
        code: affiliate.code, commissionRate: affiliate.commissionRate, referralDiscount: affiliate.referralDiscount,
        payoutMethod: affiliate.payoutMethod, paypalEmail: affiliate.paypalEmail, venmoHandle: affiliate.venmoHandle,
        cashappHandle: affiliate.cashappHandle, zelleContact: affiliate.zelleContact,
        stats: { totalClicks, totalSales, conversionRate, pendingPayout, totalEarned },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/affiliate/me", requireAffiliatesEnabled, async (req, res) => {
    try {
      const affiliate = await getAffiliateFromSession(req);
      if (!affiliate) return res.status(401).json({ message: "Not authenticated" });
      const { code, payoutMethod, payoutHandle } = req.body;
      const updates: any = {};
      if (code) {
        if (!/^[a-zA-Z0-9]{1,10}$/.test(code)) return res.status(400).json({ message: "Code must be 1-10 alphanumeric characters" });
        const existing = await storage.getAffiliateByCode(code);
        if (existing && existing.id !== affiliate.id) return res.status(400).json({ message: "This code is already taken" });
        updates.code = code;
      }
      if (payoutMethod) {
        updates.payoutMethod = payoutMethod;
        updates.paypalEmail = null; updates.venmoHandle = null; updates.cashappHandle = null; updates.zelleContact = null;
        if (payoutMethod === "paypal") updates.paypalEmail = payoutHandle;
        else if (payoutMethod === "venmo") updates.venmoHandle = payoutHandle;
        else if (payoutMethod === "cashapp") updates.cashappHandle = payoutHandle;
        else if (payoutMethod === "zelle") updates.zelleContact = payoutHandle;
      }
      await storage.updateAffiliate(affiliate.id, updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/affiliate/me/referrals", requireAffiliatesEnabled, async (req, res) => {
    try {
      const affiliate = await getAffiliateFromSession(req);
      if (!affiliate) return res.status(401).json({ message: "Not authenticated" });
      const referrals = await storage.getAffiliateReferrals(affiliate.id);
      res.json(referrals.filter(r => r.status !== "clicked"));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/affiliate/validate-code", requireAffiliatesEnabled, async (req, res) => {
    try {
      const code = (req.query.code as string || "").toLowerCase();
      if (!code) return res.status(400).json({ message: "Code is required" });
      const affiliate = await storage.getAffiliateByCode(code);
      if (!affiliate || !affiliate.active || !affiliate.approved) {
        return res.json({ valid: false });
      }
      res.json({ valid: true, discount: affiliate.referralDiscount, affiliateName: affiliate.name });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Affiliate Routes (Admin) ───────────────────────────────────────────

  app.get("/api/admin/affiliates", requireTab("affiliates"), async (_req, res) => {
    try {
      const allAffiliates = await storage.getAffiliates();
      const result = await Promise.all(allAffiliates.map(async (aff) => {
        const referrals = await storage.getAffiliateReferrals(aff.id);
        const totalClicks = referrals.length;
        const conversions = referrals.filter(r => r.status === "converted" || r.status === "paid");
        const totalSales = conversions.length;
        const totalRevenue = conversions.reduce((s, r) => s + (r.orderTotal || 0), 0);
        const unpaidEarnings = referrals.filter(r => r.status === "converted").reduce((s, r) => s + (r.commissionAmount || 0), 0);
        const paidEarnings = referrals.filter(r => r.status === "paid").reduce((s, r) => s + (r.commissionAmount || 0), 0);
        return { ...aff, stats: { totalClicks, totalSales, totalRevenue, unpaidEarnings, paidEarnings } };
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/affiliates", requireTab("affiliates"), async (req, res) => {
    try {
      const { name, email, code, commissionRate, referralDiscount, approved } = req.body;
      if (!name || !email || !code) return res.status(400).json({ message: "Name, email, and code are required" });
      const affiliate = await storage.createAffiliate({
        name, email, code,
        commissionRate: commissionRate || 10,
        referralDiscount: referralDiscount || 10,
        approved: approved !== undefined ? approved : true,
        active: true,
      });
      res.json(affiliate);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/affiliates/:id", requireTab("affiliates"), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await storage.updateAffiliate(id, updates);
      if (!updated) return res.status(404).json({ message: "Affiliate not found" });
      if (updates.approved === true) {
        const affiliate = updated;
        const siteUrl = process.env.SITE_URL || "https://aurapepts.com";
        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await storage.updateAffiliate(affiliate.id, { magicToken: token, magicTokenExpiresAt: expires } as any);
        const magicUrl = `${siteUrl}/affiliates?magic=${token}`;
        try {
          const { sendViaProvider } = await import("./email");
          const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#201C16;margin:0 0 12px;">Welcome to the Aura Peptides Affiliate Program!</h2>
            <p style="color:#6B6258;font-size:14px;">Great news — your affiliate application has been approved! You can now start sharing your referral link and earning commissions.</p>
            <p style="color:#3A332B;font-size:14px;"><strong>Your referral code:</strong> ${affiliate.code.toUpperCase()}</p>
            <p style="color:#3A332B;font-size:14px;"><strong>Commission rate:</strong> ${affiliate.commissionRate}%</p>
            <p style="color:#3A332B;font-size:14px;"><strong>Customer discount:</strong> ${affiliate.referralDiscount}% off</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${magicUrl}" style="display:inline-block;padding:14px 36px;background:#201C16;color:#fff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">Access Your Dashboard</a>
            </div>
          </div>`;
          await sendViaProvider({ to: affiliate.email, subject: "Your Affiliate Application is Approved! — Aura Peptides", html });
        } catch (emailErr: any) {
          console.error("Affiliate approval email error:", emailErr.message);
        }
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/affiliates/:id", requireTab("affiliates"), async (req, res) => {
    try {
      await storage.deleteAffiliate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/affiliates/:id/referrals", requireTab("affiliates"), async (req, res) => {
    try {
      const referrals = await storage.getAffiliateReferrals(req.params.id);
      res.json(referrals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/affiliates/:id/pay", requireTab("affiliates"), async (req, res) => {
    try {
      const count = await storage.markAffiliateReferralsPaid(req.params.id);
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/affiliates/:id/unpay", requireTab("affiliates"), async (req, res) => {
    try {
      const count = await storage.unmarkAffiliateReferralsPaid(req.params.id);
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
