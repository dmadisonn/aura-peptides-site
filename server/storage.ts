import { eq, desc, and, lte, sql, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  users, products, orders, certificates, shippingOptions, customers, siteSettings, emailLogs, abandonedCarts, newsletterSubscribers, affiliates, affiliateReferrals, productImages,
  type User, type InsertUser, type AdminPermissions,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type Certificate, type InsertCertificate,
  type ShippingOption, type InsertShippingOption,
  type Customer, type InsertCustomer,
  type EmailLog, type InsertEmailLog,
  type AbandonedCart,
  type NewsletterSubscriber,
  type Affiliate, type InsertAffiliate,
  type AffiliateReferral,
  type ProductImage,
} from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listAdminUsers(): Promise<User[]>;
  createAdminUser(data: { username: string; passwordHash: string; isSuperAdmin: boolean; permissions: AdminPermissions }): Promise<User>;
  updateAdminUser(id: string, data: { username?: string; passwordHash?: string; isSuperAdmin?: boolean; permissions?: AdminPermissions }): Promise<User | undefined>;
  deleteAdminUser(id: string): Promise<void>;
  countSuperAdmins(): Promise<number>;

  getProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrderBySessionId(sessionId: string): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: string): Promise<void>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<void>;

  getCertificates(): Promise<Certificate[]>;
  createCertificate(cert: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: string, data: Partial<InsertCertificate>): Promise<Certificate | undefined>;
  deleteCertificate(id: string): Promise<void>;

  getShippingOptions(): Promise<ShippingOption[]>;
  getShippingOptionById(id: string): Promise<ShippingOption | undefined>;
  createShippingOption(option: InsertShippingOption): Promise<ShippingOption>;
  updateShippingOption(id: string, option: Partial<InsertShippingOption>): Promise<ShippingOption | undefined>;
  deleteShippingOption(id: string): Promise<void>;

  getCustomers(): Promise<Customer[]>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  upsertCustomer(data: { email: string; name?: string; phone?: string; shippingAddress?: any; orderTotal?: number; incrementOrder?: boolean }): Promise<Customer>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  getEmailLogs(): Promise<EmailLog[]>;
  getEmailLogById(id: string): Promise<EmailLog | undefined>;

  upsertAbandonedCart(email: string, items: any, subtotal: number): Promise<void>;
  getAbandonedCartsForReminder(): Promise<AbandonedCart[]>;
  markAbandonedCartReminderSent(id: string): Promise<void>;
  markAbandonedCartConverted(email: string): Promise<void>;

  getNewsletterSubscribers(): Promise<NewsletterSubscriber[]>;
  getNewsletterSubscriberByEmail(email: string): Promise<NewsletterSubscriber | undefined>;
  getNewsletterSubscriberById(id: string): Promise<NewsletterSubscriber | undefined>;
  subscribeEmail(email: string, source?: string): Promise<NewsletterSubscriber>;
  unsubscribeEmail(email: string): Promise<void>;
  deleteNewsletterSubscriber(id: string): Promise<void>;

  getAffiliates(): Promise<Affiliate[]>;
  getAffiliateById(id: string): Promise<Affiliate | undefined>;
  getAffiliateByEmail(email: string): Promise<Affiliate | undefined>;
  getAffiliateByCode(code: string): Promise<Affiliate | undefined>;
  getAffiliateByMagicToken(token: string): Promise<Affiliate | undefined>;
  createAffiliate(data: InsertAffiliate): Promise<Affiliate>;
  updateAffiliate(id: string, data: Partial<InsertAffiliate>): Promise<Affiliate | undefined>;
  deleteAffiliate(id: string): Promise<void>;

  getAffiliateReferrals(affiliateId: string): Promise<AffiliateReferral[]>;
  getAffiliateReferralById(id: string): Promise<AffiliateReferral | undefined>;
  getAffiliateReferralBySessionToken(token: string): Promise<AffiliateReferral | undefined>;
  getAffiliateReferralByOrderId(orderId: string): Promise<AffiliateReferral | undefined>;
  createAffiliateReferral(data: { affiliateId: string; sessionToken: string }): Promise<AffiliateReferral>;
  updateAffiliateReferral(id: string, data: Partial<AffiliateReferral>): Promise<void>;
  markAffiliateReferralsPaid(affiliateId: string): Promise<number>;
  unmarkAffiliateReferralsPaid(affiliateId: string): Promise<number>;

  saveImage(data: string, contentType: string): Promise<string>;
  getImage(id: string): Promise<ProductImage | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async listAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isAdmin, true));
  }

  async createAdminUser(data: { username: string; passwordHash: string; isSuperAdmin: boolean; permissions: AdminPermissions }): Promise<User> {
    const [user] = await db.insert(users).values({
      username: data.username,
      password: data.passwordHash,
      isAdmin: true,
      isSuperAdmin: data.isSuperAdmin,
      permissions: data.permissions,
    }).returning();
    return user;
  }

  async updateAdminUser(id: string, data: { username?: string; passwordHash?: string; isSuperAdmin?: boolean; permissions?: AdminPermissions }): Promise<User | undefined> {
    const update: any = {};
    if (data.username !== undefined) update.username = data.username;
    if (data.passwordHash !== undefined) update.password = data.passwordHash;
    if (data.isSuperAdmin !== undefined) update.isSuperAdmin = data.isSuperAdmin;
    if (data.permissions !== undefined) update.permissions = data.permissions;
    if (Object.keys(update).length === 0) {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }
    const [user] = await db.update(users).set(update).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteAdminUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async countSuperAdmins(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(eq(users.isAdmin, true), eq(users.isSuperAdmin, true)));
    return result[0]?.count ?? 0;
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(asc(products.name));
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.slug, slug));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async getOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderBySessionId(sessionId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId));
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    await db.update(orders).set({ status }).where(eq(orders.id, id));
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<void> {
    await db.update(orders).set(data).where(eq(orders.id, id));
  }

  async getCertificates(): Promise<Certificate[]> {
    const rows = await db.select().from(certificates).orderBy(desc(certificates.createdAt));
    // Normalize snake_case DB keys to camelCase for frontend compatibility
    return rows.map((r: any) => ({
      id: r.id,
      productId: r.productId ?? r.product_id ?? null,
      productName: r.productName ?? r.product_name ?? "",
      batchNumber: r.batchNumber ?? r.batch_number ?? "",
      purity: r.purity ?? null,
      testedBy: r.testedBy ?? r.tested_by ?? null,
      testDate: r.testDate ?? r.test_date ?? null,
      fileUrl: r.fileUrl ?? r.file_url ?? null,
      fileType: r.fileType ?? r.file_type ?? null,
      title: r.title ?? null,
      thumbnailUrl: r.thumbnailUrl ?? r.thumbnail_url ?? null,
      notes: r.notes ?? null,
      createdAt: r.createdAt ?? r.created_at ?? null,
    })) as Certificate[];
  }

  async createCertificate(cert: InsertCertificate): Promise<Certificate> {
    const [created] = await db.insert(certificates).values(cert).returning();
    return created;
  }

  async updateCertificate(id: string, data: Partial<InsertCertificate>): Promise<Certificate | undefined> {
    const [updated] = await db.update(certificates).set(data).where(eq(certificates.id, id)).returning();
    return updated;
  }

  async deleteCertificate(id: string): Promise<void> {
    await db.delete(certificates).where(eq(certificates.id, id));
  }

  async getShippingOptions(): Promise<ShippingOption[]> {
    return db.select().from(shippingOptions).orderBy(shippingOptions.sortOrder);
  }

  async getShippingOptionById(id: string): Promise<ShippingOption | undefined> {
    const [option] = await db.select().from(shippingOptions).where(eq(shippingOptions.id, id));
    return option;
  }

  async createShippingOption(option: InsertShippingOption): Promise<ShippingOption> {
    const [created] = await db.insert(shippingOptions).values(option).returning();
    return created;
  }

  async updateShippingOption(id: string, option: Partial<InsertShippingOption>): Promise<ShippingOption | undefined> {
    const [updated] = await db.update(shippingOptions).set(option).where(eq(shippingOptions.id, id)).returning();
    return updated;
  }

  async deleteShippingOption(id: string): Promise<void> {
    await db.delete(shippingOptions).where(eq(shippingOptions.id, id));
  }

  async getCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(desc(customers.updatedAt));
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async upsertCustomer(data: { email: string; name?: string; phone?: string; shippingAddress?: any; orderTotal?: number; incrementOrder?: boolean }): Promise<Customer> {
    const existing = await this.getCustomerByEmail(data.email);
    if (existing) {
      const updates: any = { updatedAt: new Date() };
      if (data.name) updates.name = data.name;
      if (data.phone) updates.phone = data.phone;
      if (data.shippingAddress) updates.shippingAddress = data.shippingAddress;
      if (data.incrementOrder) {
        updates.orderCount = (existing.orderCount || 0) + 1;
        updates.totalSpent = (existing.totalSpent || 0) + (data.orderTotal || 0);
      }
      const [updated] = await db.update(customers).set(updates).where(eq(customers.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(customers).values({
        email: data.email,
        name: data.name || null,
        phone: data.phone || null,
        shippingAddress: data.shippingAddress || null,
        orderCount: data.incrementOrder ? 1 : 0,
        totalSpent: data.incrementOrder ? (data.orderTotal || 0) : 0,
      }).returning();
      return created;
    }
  }

  async getSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== null) {
      await db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({ key, value });
    }
  }

  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [created] = await db.insert(emailLogs).values(log).returning();
    return created;
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    return db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt));
  }

  async getEmailLogById(id: string): Promise<EmailLog | undefined> {
    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, id));
    return log;
  }

  async upsertAbandonedCart(email: string, items: any, subtotal: number): Promise<void> {
    const [existing] = await db.select().from(abandonedCarts)
      .where(and(eq(abandonedCarts.email, email), eq(abandonedCarts.convertedToOrder, false)));
    if (existing) {
      await db.update(abandonedCarts)
        .set({ items, subtotal, updatedAt: new Date() })
        .where(eq(abandonedCarts.id, existing.id));
    } else {
      await db.insert(abandonedCarts).values({ email, items, subtotal });
    }
  }

  async getAbandonedCartsForReminder(): Promise<AbandonedCart[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return db.select().from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.reminderSent, false),
        eq(abandonedCarts.convertedToOrder, false),
        lte(abandonedCarts.updatedAt, oneHourAgo),
      ));
  }

  async markAbandonedCartReminderSent(id: string): Promise<void> {
    await db.update(abandonedCarts).set({ reminderSent: true }).where(eq(abandonedCarts.id, id));
  }

  async markAbandonedCartConverted(email: string): Promise<void> {
    await db.update(abandonedCarts)
      .set({ convertedToOrder: true })
      .where(and(eq(abandonedCarts.email, email), eq(abandonedCarts.convertedToOrder, false)));
  }

  async getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
    return db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));
  }

  async getNewsletterSubscriberByEmail(email: string): Promise<NewsletterSubscriber | undefined> {
    const [sub] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    return sub;
  }

  async getNewsletterSubscriberById(id: string): Promise<NewsletterSubscriber | undefined> {
    const [sub] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
    return sub;
  }

  async subscribeEmail(email: string, source?: string): Promise<NewsletterSubscriber> {
    const existing = await this.getNewsletterSubscriberByEmail(email);
    if (existing) {
      const [updated] = await db.update(newsletterSubscribers)
        .set({ subscribed: true, updatedAt: new Date() })
        .where(eq(newsletterSubscribers.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(newsletterSubscribers)
      .values({ email, source: source || "website" })
      .returning();
    return created;
  }

  async unsubscribeEmail(email: string): Promise<void> {
    const existing = await this.getNewsletterSubscriberByEmail(email);
    if (existing) {
      await db.update(newsletterSubscribers)
        .set({ subscribed: false, updatedAt: new Date() })
        .where(eq(newsletterSubscribers.email, email));
    } else {
      await db.insert(newsletterSubscribers)
        .values({ email, subscribed: false, source: "unsubscribe" });
    }
  }

  async deleteNewsletterSubscriber(id: string): Promise<void> {
    await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
  }

  async getAffiliates(): Promise<Affiliate[]> {
    return db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
  }

  async getAffiliateById(id: string): Promise<Affiliate | undefined> {
    const [aff] = await db.select().from(affiliates).where(eq(affiliates.id, id));
    return aff;
  }

  async getAffiliateByEmail(email: string): Promise<Affiliate | undefined> {
    const [aff] = await db.select().from(affiliates).where(eq(affiliates.email, email.toLowerCase()));
    return aff;
  }

  async getAffiliateByCode(code: string): Promise<Affiliate | undefined> {
    const [aff] = await db.select().from(affiliates).where(eq(affiliates.code, code.toLowerCase()));
    return aff;
  }

  async getAffiliateByMagicToken(token: string): Promise<Affiliate | undefined> {
    const [aff] = await db.select().from(affiliates).where(eq(affiliates.magicToken, token));
    return aff;
  }

  async createAffiliate(data: InsertAffiliate): Promise<Affiliate> {
    const [created] = await db.insert(affiliates).values({ ...data, email: data.email.toLowerCase(), code: data.code.toLowerCase() }).returning();
    return created;
  }

  async updateAffiliate(id: string, data: Partial<InsertAffiliate>): Promise<Affiliate | undefined> {
    const updates: any = { ...data, updatedAt: new Date() };
    if (data.email) updates.email = data.email.toLowerCase();
    if (data.code) updates.code = data.code.toLowerCase();
    const [updated] = await db.update(affiliates).set(updates).where(eq(affiliates.id, id)).returning();
    return updated;
  }

  async deleteAffiliate(id: string): Promise<void> {
    await db.delete(affiliateReferrals).where(eq(affiliateReferrals.affiliateId, id));
    await db.delete(affiliates).where(eq(affiliates.id, id));
  }

  async getAffiliateReferrals(affiliateId: string): Promise<AffiliateReferral[]> {
    return db.select().from(affiliateReferrals).where(eq(affiliateReferrals.affiliateId, affiliateId)).orderBy(desc(affiliateReferrals.clickedAt));
  }

  async getAffiliateReferralById(id: string): Promise<AffiliateReferral | undefined> {
    const [ref] = await db.select().from(affiliateReferrals).where(eq(affiliateReferrals.id, id));
    return ref;
  }

  async getAffiliateReferralBySessionToken(token: string): Promise<AffiliateReferral | undefined> {
    const [ref] = await db.select().from(affiliateReferrals).where(eq(affiliateReferrals.sessionToken, token));
    return ref;
  }

  async getAffiliateReferralByOrderId(orderId: string): Promise<AffiliateReferral | undefined> {
    const [ref] = await db.select().from(affiliateReferrals).where(eq(affiliateReferrals.orderId, orderId));
    return ref;
  }

  async createAffiliateReferral(data: { affiliateId: string; sessionToken: string }): Promise<AffiliateReferral> {
    const [created] = await db.insert(affiliateReferrals).values({ affiliateId: data.affiliateId, sessionToken: data.sessionToken, status: "clicked" }).returning();
    return created;
  }

  async updateAffiliateReferral(id: string, data: Partial<AffiliateReferral>): Promise<void> {
    await db.update(affiliateReferrals).set(data).where(eq(affiliateReferrals.id, id));
  }

  async markAffiliateReferralsPaid(affiliateId: string): Promise<number> {
    const result = await db.update(affiliateReferrals)
      .set({ status: "paid" })
      .where(and(eq(affiliateReferrals.affiliateId, affiliateId), eq(affiliateReferrals.status, "converted")))
      .returning();
    return result.length;
  }

  async unmarkAffiliateReferralsPaid(affiliateId: string): Promise<number> {
    const result = await db.update(affiliateReferrals)
      .set({ status: "converted" })
      .where(and(eq(affiliateReferrals.affiliateId, affiliateId), eq(affiliateReferrals.status, "paid")))
      .returning();
    return result.length;
  }

  async saveImage(data: string, contentType: string): Promise<string> {
    const [img] = await db.insert(productImages).values({ data, contentType }).returning();
    return img.id;
  }

  async getImage(id: string): Promise<ProductImage | undefined> {
    const [img] = await db.select().from(productImages).where(eq(productImages.id, id));
    return img;
  }
}

export const storage = new DatabaseStorage();
