import PDFDocument from "pdfkit";
import path from "path";
import type { Request, Response } from "express";
import { storage } from "./storage";

const NAVY   = "#201C16";
const CLOUD  = "#E9E2D5";
const SMOKE  = "#D3D6E0";
const GRAPH  = "#6B6258";
const ARSENIC = "#3A332B";
const WHITE  = "#FFFFFF";
const W = 612;

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function cents(n: number): string {
  return `$${(n).toFixed(2)}`;
}

function drawPageBorder(doc: InstanceType<typeof PDFDocument>) {
  doc.rect(0, 0, W, 5).fill(NAVY);
}

export async function packingSlipHandler(req: Request, res: Response) {
  try {
    const order = await storage.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const items = (order.items as any[]) || [];
    const productItems = items.filter((i: any) => !i.isShipping);
    const shippingItem  = items.find((i: any) => i.isShipping);
    const addr = (order.shippingAddress as any) || {};
    const isPickup = addr.pickup === true;

    const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="packing-slip-${order.id.slice(0,8).toUpperCase()}.pdf"`);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.end(Buffer.concat(chunks));
    });

    const logoPath = path.join(process.cwd(), "public", "images", "logo-mark.png");

    // ── Header ──────────────────────────────────────────────────────────────
    drawPageBorder(doc);

    // Half-inch (36pt) top padding — all header elements offset from TOP = 41
    const TOP = 41;

    try {
      doc.image(logoPath, 40, TOP, { height: 44 });
    } catch {}

    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY)
      .text("AURA PEPTIDES", 90, TOP + 6, { width: 200 });
    doc.font("Helvetica").fontSize(8).fillColor(GRAPH)
      .text("aurapepts.com", 90, TOP + 17, { width: 200 });

    doc.font("Helvetica-Bold").fontSize(20).fillColor(NAVY)
      .text("PACKING SLIP", 0, TOP + 4, { width: W - 40, align: "right" });

    doc.font("Helvetica").fontSize(8).fillColor(GRAPH)
      .text(`Order #${order.id.slice(0,8).toUpperCase()}`, 0, TOP + 28, { width: W - 40, align: "right" })
      .text(`Date: ${formatDate(order.createdAt)}`, 0, TOP + 38, { width: W - 40, align: "right" });

    let y = TOP + 58;

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.rect(40, y, W - 80, 1).fill(SMOKE);
    y += 12;

    // ── Two-column info row ───────────────────────────────────────────────────
    const colW = (W - 80) / 2 - 8;

    // Ship To / Pickup box
    const boxH = isPickup ? 70 : 100;
    doc.rect(40, y, colW, boxH).fillAndStroke(CLOUD, SMOKE);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GRAPH)
      .text(isPickup ? "PICKUP" : "SHIP TO", 52, y + 8);
    doc.font("Helvetica").fontSize(9).fillColor(ARSENIC);
    if (isPickup) {
      doc.text(addr.location || "Local Pickup", 52, y + 20, { width: colW - 24 });
    } else {
      let ay = y + 20;
      if (addr.name) { doc.font("Helvetica-Bold").text(addr.name, 52, ay, { width: colW - 24 }); ay += 13; }
      doc.font("Helvetica");
      if (addr.line1) { doc.text(addr.line1, 52, ay, { width: colW - 24 }); ay += 13; }
      if (addr.line2) { doc.text(addr.line2, 52, ay, { width: colW - 24 }); ay += 13; }
      if (addr.city || addr.state || addr.zip) {
        doc.text(`${addr.city || ""}, ${addr.state || ""} ${addr.zip || ""}`.trim(), 52, ay, { width: colW - 24 });
      }
    }

    // Order summary box
    const sx = 40 + colW + 16;
    doc.rect(sx, y, colW, boxH).fillAndStroke(CLOUD, SMOKE);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GRAPH)
      .text("ORDER INFO", sx + 12, y + 8);
    doc.font("Helvetica").fontSize(9).fillColor(ARSENIC);
    doc.text(`Email: ${order.email}`, sx + 12, y + 22, { width: colW - 24 });
    if (order.phone) doc.text(`Phone: ${order.phone}`, sx + 12, y + 35, { width: colW - 24 });
    if (order.trackingNumber) {
      const carrier = (order as any).carrier || "";
      const cl = carrier === "usps" ? "USPS" : carrier === "ups" ? "UPS" : carrier === "fedex" ? "FedEx" : carrier === "dhl" ? "DHL" : "";
      doc.text(`${cl ? cl + " " : ""}Tracking: ${order.trackingNumber}`, sx + 12, order.phone ? y + 48 : y + 35, { width: colW - 24 });
    }

    y += boxH + 16;

    // ── Items Table ───────────────────────────────────────────────────────────
    // Column x-positions and widths
    const COL_QTY_X   = 40;   const COL_QTY_W   = 42;
    const COL_NAME_X  = 88;   const COL_NAME_W  = 300;
    const COL_UNIT_X  = 394;  const COL_UNIT_W  = 88;
    const COL_TOT_X   = 486;  const COL_TOT_W   = 86;  // ends at 572 = W-40
    const HDR_H = 28;
    const ROW_H = 30;
    const FONT_SZ = 9;
    // Vertical center helper: (rowHeight - fontSize) / 2
    const vc = (rh: number) => Math.round((rh - FONT_SZ) / 2);

    const NUM_PAD = 10; // right padding for all number cells

    // Table header bar
    doc.rect(40, y, W - 80, HDR_H).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
    doc.text("QTY",        COL_QTY_X,  y + vc(HDR_H), { width: COL_QTY_W,           align: "center" });
    doc.text("DESCRIPTION",COL_NAME_X, y + vc(HDR_H), { width: COL_NAME_W,           align: "left" });
    doc.text("UNIT PRICE", COL_UNIT_X, y + vc(HDR_H), { width: COL_UNIT_W - NUM_PAD, align: "right" });
    doc.text("TOTAL",      COL_TOT_X,  y + vc(HDR_H), { width: COL_TOT_W  - NUM_PAD, align: "right" });
    y += HDR_H;

    // Item rows
    productItems.forEach((item: any, i: number) => {
      const bg = i % 2 === 0 ? WHITE : CLOUD;
      // Fill background
      doc.rect(40, y, W - 80, ROW_H).fill(bg);
      // Bottom border only — cleaner than full outline
      doc.moveTo(40, y + ROW_H).lineTo(W - 40, y + ROW_H).strokeColor(SMOKE).lineWidth(0.5).stroke();

      const ty = y + vc(ROW_H);
      doc.font("Helvetica").fontSize(FONT_SZ).fillColor(ARSENIC);
      doc.text(String(item.quantity), COL_QTY_X,  ty, { width: COL_QTY_W,  align: "center" });
      doc.text(item.name || "",       COL_NAME_X, ty, { width: COL_NAME_W, align: "left" });
      doc.font("Helvetica").fillColor(GRAPH);
      doc.text(cents(item.price),                 COL_UNIT_X, ty, { width: COL_UNIT_W - NUM_PAD, align: "right" });
      doc.font("Helvetica-Bold").fillColor(ARSENIC);
      doc.text(cents(item.price * item.quantity), COL_TOT_X,  ty, { width: COL_TOT_W  - NUM_PAD, align: "right" });
      y += ROW_H;
    });

    y += 12;

    // ── Totals ────────────────────────────────────────────────────────────────
    const totW = 220;
    const totX = W - 40 - totW;
    const subtotal = productItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    const shippingCost = shippingItem ? shippingItem.price : 0;

    // Subtotal & shipping rows
    const totRows = [
      { label: "Subtotal", value: cents(subtotal) },
      { label: "Shipping", value: shippingCost === 0 ? "Free" : cents(shippingCost) },
    ];

    totRows.forEach(({ label, value }) => {
      doc.font("Helvetica").fontSize(9).fillColor(GRAPH)
        .text(label, totX, y, { width: totW - 12, align: "left" });
      doc.font("Helvetica").fontSize(9).fillColor(ARSENIC)
        .text(value, totX, y, { width: totW - NUM_PAD, align: "right" });
      y += 20;
    });

    // Thin divider above grand total
    doc.moveTo(totX, y).lineTo(W - 40, y).strokeColor(SMOKE).lineWidth(0.75).stroke();
    y += 8;

    // Grand total bar
    const TOT_BAR_H = 34;
    doc.rect(totX, y, totW, TOT_BAR_H).fill(NAVY);
    const totMid = y + Math.round((TOT_BAR_H - 11) / 2);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE)
      .text("TOTAL", totX + 14, totMid, { width: totW - 28, align: "left" });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(WHITE)
      .text(cents(order.total), totX + 14, totMid - 1, { width: totW - 14 - NUM_PAD, align: "right" });
    y += TOT_BAR_H + 20;

    // ── Items count confirmation ──────────────────────────────────────────────
    doc.font("Helvetica").fontSize(8).fillColor(GRAPH)
      .text(`${productItems.reduce((s: number, i: any) => s + i.quantity, 0)} item(s) enclosed`, 40, y);
    y += 20;

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.rect(40, y, W - 80, 1).fill(SMOKE);
    y += 12;

    // ── Disclaimer ────────────────────────────────────────────────────────────
    doc.font("Helvetica").fontSize(7).fillColor(GRAPH)
      .text(
        "FOR RESEARCH USE ONLY — NOT FOR HUMAN CONSUMPTION. This product is intended solely for in vitro research and laboratory use. Not intended for diagnostic or therapeutic use.",
        40, y, { width: W - 80, align: "center" }
      );

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = 792 - 36;
    doc.rect(0, footerY - 4, W, 1).fill(SMOKE);
    doc.font("Helvetica").fontSize(7).fillColor(GRAPH)
      .text("Aura Peptides  ·  aurapepts.com  ·  Thank you for your order", 0, footerY + 4, { width: W, align: "center" });

    doc.end();
  } catch (err: any) {
    console.error("Packing slip error:", err);
    res.status(500).json({ message: err.message });
  }
}
