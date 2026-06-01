import { pgTable, text, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Admin Permissions ─────────────────────────────────────────────────────────
export const AdminPermissionsSchema = z.object({
  products: z.boolean().default(false),
  orders: z.boolean().default(false),
  customers: z.boolean().default(false),
  affiliates: z.boolean().default(false),
  settings: z.boolean().default(false),
  tabs: z.array(z.string()).optional(),
}).partial();

export type AdminPermissions = z.infer<typeof AdminPermissionsSchema>;

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  permissions: jsonb("permissions").$type<AdminPermissions>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ── Products ──────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  subtitle: text("subtitle"),
  description: text("description"),
  price: integer("price").notNull(),
  compareAtPrice: integer("compare_at_price"),
  category: text("category"),
  tags: jsonb("tags").$type<string[]>().default([]),
  imageUrl: text("image_url"),
  inStock: boolean("in_stock").default(true).notNull(),
  stockQuantity: integer("stock_quantity"),
  sku: text("sku"),
  weight: real("weight"),
  featured: boolean("featured").default(false),
  published: boolean("published").default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// ── Product Images ────────────────────────────────────────────────────────────
export const productImages = pgTable("product_images", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true, createdAt: true });
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;

// ── Orders ────────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderNumber: text("order_number").notNull().unique(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  items: jsonb("items").$type<CartItem[]>().notNull(),
  subtotal: integer("subtotal").notNull(),
  shippingCost: integer("shipping_cost").default(0),
  tax: integer("tax").default(0),
  total: integer("total").notNull(),
  status: text("status").default("pending"),
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
  shippingOption: text("shipping_option"),
  trackingNumber: text("tracking_number"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  affiliateCode: text("affiliate_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// ── Certificates ──────────────────────────────────────────────────────────────
export const certificates = pgTable("certificates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id"),
  productName: text("product_name").notNull(),
  batchNumber: text("batch_number").notNull(),
  purity: text("purity"),
  testedBy: text("tested_by"),
  testDate: text("test_date"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  title: text("title"),
  thumbnailUrl: text("thumbnail_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, createdAt: true });
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;

// ── Shipping Options ──────────────────────────────────────────────────────────
export const shippingOptions = pgTable("shipping_options", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  estimatedDays: text("estimated_days"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertShippingOptionSchema = createInsertSchema(shippingOptions).omit({ id: true, createdAt: true });
export type ShippingOption = typeof shippingOptions.$inferSelect;
export type InsertShippingOption = z.infer<typeof insertShippingOptionSchema>;

// ── Customers ─────────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  defaultAddress: jsonb("default_address").$type<ShippingAddress>(),
  totalOrders: integer("total_orders").default(0),
  totalSpent: integer("total_spent").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// ── Site Settings ─────────────────────────────────────────────────────────────
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("singleton"),
  storeName: text("store_name").default("Aura Peptides"),
  storeEmail: text("store_email"),
  supportEmail: text("support_email"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#8b5cf6"),
  freeShippingThreshold: integer("free_shipping_threshold"),
  stripePublishableKey: text("stripe_publishable_key"),
  resendApiKey: text("resend_api_key"),
  fromEmail: text("from_email"),
  affiliateCommissionRate: real("affiliate_commission_rate").default(0.1),
  affiliateBannerEnabled: boolean("affiliate_banner_enabled").default(false),
  affiliateBannerText: text("affiliate_banner_text"),
  featureFlags: jsonb("feature_flags").$type<Record<string, boolean>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SiteSettings = typeof siteSettings.$inferSelect;

// ── Email Logs ────────────────────────────────────────────────────────────────
export const emailLogs = pgTable("email_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  toEmail: text("to_email").notNull(),
  fromEmail: text("from_email"),
  subject: text("subject").notNull(),
  type: text("type"),
  templateType: text("template_type"),
  status: text("status").default("sent"),
  htmlContent: text("html_content"),
  orderId: text("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({ id: true, createdAt: true });
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;

// ── Abandoned Carts ───────────────────────────────────────────────────────────
export const abandonedCarts = pgTable("abandoned_carts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  items: jsonb("items").$type<CartItem[]>().notNull(),
  total: integer("total").notNull(),
  reminderSentAt: timestamp("reminder_sent_at"),
  recoveredAt: timestamp("recovered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AbandonedCart = typeof abandonedCarts.$inferSelect;

// ── Newsletter Subscribers ────────────────────────────────────────────────────
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").default(true),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

// ── Affiliates ────────────────────────────────────────────────────────────────
export const affiliates = pgTable("affiliates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  commissionRate: real("commission_rate").default(0.1),
  totalEarned: integer("total_earned").default(0),
  totalPaid: integer("total_paid").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ id: true, createdAt: true });
export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;

// ── Affiliate Referrals ───────────────────────────────────────────────────────
export const affiliateReferrals = pgTable("affiliate_referrals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  affiliateId: text("affiliate_id").notNull(),
  orderId: text("order_id").notNull(),
  commission: integer("commission").notNull(),
  status: text("status").default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AffiliateReferral = typeof affiliateReferrals.$inferSelect;

// ── Shared Types ──────────────────────────────────────────────────────────────
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  imageUrl?: string | null;
  slug?: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ─── Admin Tab & Settings Keys ────────────────────────────────────────────────
export const ADMIN_TAB_KEYS = [
  "dashboard",
  "products",
  "orders",
  "customers",
  "certificates",
  "emails",
  "affiliates",
  "subscribers",
  "settings",
  "users",
] as const;

export type AdminTabKey = typeof ADMIN_TAB_KEYS[number];

export const SETTINGS_SECTION_KEYS = [
  "general",
  "shipping",
  "payments",
  "emails",
  "affiliates",
  "feature-flags",
  "security",
] as const;

export type SettingsSectionKey = typeof SETTINGS_SECTION_KEYS[number];

export interface SettingsSectionDefinition {
  key: SettingsSectionKey;
  label: string;
  description: string;
}

export const SETTINGS_SECTION_DEFINITIONS: SettingsSectionDefinition[] = [
  { key: "general",       label: "General",       description: "Store name, logo, and branding" },
  { key: "shipping",      label: "Shipping",       description: "Shipping rates and options" },
  { key: "payments",      label: "Payments",       description: "Stripe and payment configuration" },
  { key: "emails",        label: "Emails",         description: "Email templates and SMTP settings" },
  { key: "affiliates",    label: "Affiliates",     description: "Commission rates and affiliate program" },
  { key: "feature-flags", label: "Feature Flags",  description: "Enable or disable site features" },
  { key: "security",      label: "Security",       description: "Admin access and security settings" },
];
